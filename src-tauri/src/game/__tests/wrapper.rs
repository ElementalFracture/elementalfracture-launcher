//! Tests for `game/wrapper.rs`.

use super::*;
use std::fs;

/// An executable at a path with a space in it — the shape that used to be
/// torn in half at the space and reported as "isn't installed".
fn spaced_wine() -> (tempfile::TempDir, String) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("test space").join("bin");
    fs::create_dir_all(&dir).unwrap();
    let exe = dir.join("wine");
    fs::write(&exe, b"#!/bin/sh\nexit 0\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&exe, fs::Permissions::from_mode(0o755)).unwrap();
    }
    let path = exe.to_string_lossy().into_owned();
    (tmp, path)
}

#[test]
fn wrapper_path_with_spaces_stays_whole() {
    let (_tmp, path) = spaced_wine();
    assert_eq!(parse_wrapper(&path), std::slice::from_ref(&path));
    // Leading/trailing slack must not turn it into a word list either.
    assert_eq!(parse_wrapper(&format!("  {path}  ")), [path]);
}

#[test]
fn multi_word_wrappers_still_split() {
    assert_eq!(
        parse_wrapper("flatpak run org.winehq.Wine"),
        ["flatpak", "run", "org.winehq.Wine"]
    );
    assert_eq!(
        parse_wrapper("steam steam://rungameid/18150169937639899136"),
        ["steam", "steam://rungameid/18150169937639899136"]
    );
    assert_eq!(parse_wrapper("umu-run"), ["umu-run"]);
    // An absolute path that isn't there falls back to the word split
    // rather than claiming to be a program.
    assert_eq!(parse_wrapper("/no/such/wine --foo"), ["/no/such/wine", "--foo"]);
}

#[cfg(unix)]
#[test]
fn availability_survives_spaces_and_quotes() {
    let (_tmp, path) = spaced_wine();
    assert!(wrapper_available(&path), "spaced path should resolve: {path}");
    assert!(wrapper_available("sh"));
    // A value carrying shell syntax must fail the check, not execute.
    let canary = tempfile::tempdir().unwrap();
    let target = canary.path().join("CANARY");
    fs::write(&target, b"x").unwrap();
    let evil = format!(r#"x" ; rm -f "{}" ; ""#, target.display());
    assert!(!wrapper_available(&evil));
    assert!(target.exists(), "injected command ran");
}

/// The same canary against `command_present`. This is the one that used to
/// build its script with `format!`, so a wrapper name carrying shell syntax
/// was parsed and run by `sh` rather than looked up.
#[cfg(unix)]
#[test]
fn presence_check_looks_names_up_rather_than_running_them() {
    assert!(command_present("sh"));
    assert!(!command_present(""));
    assert!(!command_present("definitely-not-a-real-program-xyz"));

    let canary = tempfile::tempdir().unwrap();
    let target = canary.path().join("CANARY");
    fs::write(&target, b"x").unwrap();
    // Not absolute, so it reaches the lookup rather than the exists() branch.
    let evil = format!(r#"x" ; rm -f "{}" ; ""#, target.display());
    assert!(!command_present(&evil));
    assert!(target.exists(), "injected command ran");

    // A backtick / $() payload has to be inert too, not just the `;` shape.
    let sub = format!(r#"x`rm -f {}`"#, target.display());
    assert!(!command_present(&sub));
    assert!(target.exists(), "backtick substitution ran");
}

/// An absolute path never reaches the shell at all — it is tested on disk —
/// but it must still survive spaces.
#[cfg(unix)]
#[test]
fn presence_check_handles_absolute_paths_with_spaces() {
    let (_tmp, path) = spaced_wine();
    assert!(command_present(&path));
    assert!(!command_present("/no/such/wine"));
}

#[test]
fn a_steam_run_command_is_recognised() {
    let run = "steam steam://rungameid/18150169937639899136";
    assert_eq!(
        steam_run(run).unwrap(),
        ["steam", "steam://rungameid/18150169937639899136"]
    );
    assert!(steam_run("/usr/bin/steam steam://rungameid/1").is_some());
    for other in ["umu-run", "steam", "steam -applaunch 1399780", "steam steam://rungameid/1 extra"] {
        assert!(steam_run(other).is_none(), "{other:?}");
    }
}
