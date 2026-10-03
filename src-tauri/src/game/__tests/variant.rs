//! Tests for `game/variant.rs`.

use super::*;

fn paks(files: &[&str]) -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let paks = paks_dir(tmp.path());
    fs::create_dir_all(&paks).unwrap();
    for f in files {
        fs::write(paks.join(f), b"x").unwrap();
    }
    (tmp, paks)
}

fn names(paks: &Path) -> Vec<String> {
    let mut v: Vec<String> = fs::read_dir(paks)
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .collect();
    v.sort();
    v
}

#[test]
fn parked_to_ef_and_back() {
    // A legacy `.1` park still restores; parking now writes `.bak`.
    let (tmp, p) = paks(&["ElefracBalance_P.pak.1", "ElefracBalance_P.sig.1"]);
    assert_eq!(detect_variant(tmp.path()), "classic");
    apply_variant(&p, "ef").unwrap();
    assert_eq!(names(&p), ["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
    assert_eq!(detect_variant(tmp.path()), "ef");
    apply_variant(&p, "classic").unwrap();
    assert_eq!(names(&p), ["ElefracBalance_P.pak.bak", "ElefracBalance_P.sig.bak"]);
}

#[test]
fn both_copies_present_after_update() {
    let (tmp, p) = paks(&[
        "ElefracBalance_P.pak",
        "ElefracBalance_P.pak.bak",
        "ElefracBalance_P.sig",
        "ElefracBalance_P.sig.bak",
    ]);
    assert_eq!(detect_variant(tmp.path()), "ef");
    apply_variant(&p, "classic").unwrap();
    assert_eq!(names(&p), ["ElefracBalance_P.pak.bak", "ElefracBalance_P.sig.bak"]);
    apply_variant(&p, "ef").unwrap();
    assert_eq!(names(&p), ["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
}

#[test]
fn pak_never_installed() {
    let (tmp, p) = paks(&[]);
    // Vanilla paks folder: classic is simply the truth.
    assert_eq!(detect_variant(tmp.path()), "classic");
    apply_variant(&p, "classic").unwrap();
    // EF without the pak anywhere must fail loudly, not pretend.
    let err = apply_variant(&p, "ef").unwrap_err();
    assert_eq!(err.code, ErrorCode::VariantPakMissing, "{err:?}");
}

#[test]
fn three_way_prod_playtest_vanilla() {
    // Both balance paks installed, production active.
    let (tmp, p) = paks(&[
        "ElefracBalance_P.pak",
        "ElefracBalance_P.sig",
        "ElefracTest_P.pak",
        "ElefracTest_P.sig",
    ]);
    // Prod: Test parked, Balance active.
    apply_variant(&p, "ef").unwrap();
    assert_eq!(detect_variant(tmp.path()), "ef");
    assert_eq!(
        names(&p),
        [
            "ElefracBalance_P.pak",
            "ElefracBalance_P.sig",
            "ElefracTest_P.pak.bak",
            "ElefracTest_P.sig.bak",
        ]
    );
    assert!(test_build_installed(tmp.path()));

    // Playtest: Balance parked, Playtest active.
    apply_variant(&p, "playtest").unwrap();
    assert_eq!(detect_variant(tmp.path()), "playtest");
    assert_eq!(
        names(&p),
        [
            "ElefracBalance_P.pak.bak",
            "ElefracBalance_P.sig.bak",
            "ElefracTest_P.pak",
            "ElefracTest_P.sig",
        ]
    );

    // Vanilla: both parked.
    apply_variant(&p, "classic").unwrap();
    assert_eq!(detect_variant(tmp.path()), "classic");
    assert_eq!(
        names(&p),
        [
            "ElefracBalance_P.pak.bak",
            "ElefracBalance_P.sig.bak",
            "ElefracTest_P.pak.bak",
            "ElefracTest_P.sig.bak",
        ]
    );
    assert!(test_build_installed(tmp.path()));

    // Back to prod from vanilla restores Balance, leaves Test parked.
    apply_variant(&p, "ef").unwrap();
    assert_eq!(detect_variant(tmp.path()), "ef");
}

#[test]
fn playtest_without_pak_fails() {
    let (tmp, p) = paks(&["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
    assert!(!test_build_installed(tmp.path()));
    let err = apply_variant(&p, "playtest").unwrap_err();
    assert_eq!(err.code, ErrorCode::PlaytestPakMissing, "{err:?}");
}

#[test]
fn no_paks_dir_is_unknown() {
    let tmp = tempfile::tempdir().unwrap();
    assert_eq!(detect_variant(tmp.path()), "unknown");
}

/// `switch_to` is what the Playtest installer calls, and the marker it
/// leaves is how the in-game controller knows which balance is loaded.
#[test]
fn switching_leaves_the_mode_marker_the_injector_reads() {
    let (tmp, _p) = paks(&["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
    let root = tmp.path().to_string_lossy().into_owned();

    assert_eq!(switch_to(&root, "ef").unwrap(), "ef");
    assert_eq!(fs::read_to_string(tmp.path().join(".ef_mode")).unwrap(), "ef\n");

    assert_eq!(switch_to(&root, "classic").unwrap(), "classic");
    assert_eq!(fs::read_to_string(tmp.path().join(".ef_mode")).unwrap(), "classic\n");
}

#[test]
fn switching_says_which_precondition_failed() {
    assert_eq!(switch_to("", "ef").unwrap_err().code, ErrorCode::NoGameFolder);

    // A real folder that simply isn't a game install.
    let tmp = tempfile::tempdir().unwrap();
    assert_eq!(
        switch_to(&tmp.path().to_string_lossy(), "ef").unwrap_err().code,
        ErrorCode::PaksNotFound
    );
}

/// A variant name the launcher doesn't know must not quietly park
/// everything and leave the player on vanilla.
#[test]
fn an_unknown_variant_is_refused_rather_than_guessed() {
    let (_tmp, p) = paks(&["ElefracBalance_P.pak"]);
    let err = apply_variant(&p, "beta").unwrap_err();
    assert_eq!(err.code, ErrorCode::UnknownVariant);
    assert_eq!(err.params.get("variant").map(String::as_str), Some("beta"));
    // Nothing moved.
    assert!(p.join("ElefracBalance_P.pak").exists());
}

#[test]
fn a_fresh_install_without_the_balance_pak_is_meant_to_be_ef() {
    // Base game only: the update that delivers ElefracBalance_P.pak has not run yet.
    let (tmp, _p) = paks(&["pakchunk0-WindowsNoEditor.pak"]);
    assert_eq!(detect_variant(tmp.path()), "classic");
    assert_eq!(intended_variant(tmp.path()), "ef");
}

#[test]
fn a_pak_parked_by_the_old_bug_is_restored() {
    let (tmp, p) = paks(&["ElefracBalance_P.pak.bak", "ElefracBalance_P.sig.bak"]);
    assert_eq!(intended_variant(tmp.path()), "ef");
    assert_eq!(heal_variant(tmp.path()).as_deref(), Some("ef"));
    assert!(p.join("ElefracBalance_P.pak").exists());
    assert_eq!(fs::read_to_string(tmp.path().join(".ef_mode")).unwrap(), "ef\n");
    // Already on EF: nothing to heal.
    assert!(heal_variant(tmp.path()).is_none());
}

#[test]
fn a_player_who_chose_classic_stays_on_classic() {
    let (tmp, p) = paks(&["ElefracBalance_P.pak.bak", "ElefracBalance_P.sig.bak"]);
    record_choice(tmp.path(), "classic");
    assert_eq!(chosen_variant(tmp.path()).as_deref(), Some("classic"));
    assert_eq!(intended_variant(tmp.path()), "classic");
    assert!(heal_variant(tmp.path()).is_none());
    assert!(!p.join("ElefracBalance_P.pak").exists());
    // Choosing EF again lifts it.
    record_choice(tmp.path(), "ef");
    assert_eq!(heal_variant(tmp.path()).as_deref(), Some("ef"));
}
