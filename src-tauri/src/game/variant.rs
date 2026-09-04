//! Which balance pak the game loads. Only one is ever mounted; the others are
//! parked beside it as `<name>.bak`, exactly like the old rename.bat did.

use super::install::paks_dir;
use super::markers::write_hidden_mode;
use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;
use std::fs;
use std::path::{Path, PathBuf};

// The production (Elemental Fracture) balance pak, and the Playtest balance
// pak. Only one balance pak is ever mounted at a time; the others
// are parked out of the way as `<name>.bak` (older installs used `.1`).
const PAK: &str = "ElefracBalance_P.pak";
const SIG: &str = "ElefracBalance_P.sig";
const TEST_PAK: &str = "ElefracTest_P.pak";
const TEST_SIG: &str = "ElefracTest_P.sig";

/// Parked-copy suffixes, newest first: we write `.bak` but still restore a
/// legacy `.1` left by older launcher versions.
const PARK_SUFFIXES: &[&str] = &["bak", "1"];

pub fn detect_variant(root: &Path) -> String {
    let paks = paks_dir(root);
    if paks.join(TEST_PAK).exists() {
        // The Playtest pak is mounted.
        "playtest".into()
    } else if paks.join(PAK).exists() {
        "ef".into()
    } else if paks.is_dir() {
        // No active balance pak — whether they're parked as .bak or simply
        // not installed, the game plays vanilla.
        "classic".into()
    } else {
        "unknown".into()
    }
}

/// True when the Playtest pak is on disk at all (mounted or parked), so
/// switching to it needs no download.
pub fn test_build_installed(root: &Path) -> bool {
    let paks = paks_dir(root);
    paks.join(TEST_PAK).exists() || parked_path(&paks, TEST_PAK).is_some()
}

/// Switch the game between Production ("ef"), Vanilla ("classic") and the
/// Playtest channel ("playtest") by parking the balance paks we don't want and
/// restoring the one we do, exactly like the old rename.bat / restore.bat did.
#[tauri::command]
#[specta::specta]
pub fn set_variant(app: tauri::AppHandle, variant: String) -> AppResult<String> {
    let s = settings::load(&app);
    switch_to(&s.game_path, &variant)
}

/// Core of set_variant, reusable by the Playtest installer: apply the
/// variant's pak layout and refresh the `.ef_mode` marker to match.
pub fn switch_to(game_path: &str, variant: &str) -> AppResult<String> {
    if game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let root = Path::new(game_path);
    let paks = paks_dir(root);
    if !paks.is_dir() {
        return Err(AppError::new(ErrorCode::PaksNotFound).with("path", paks.display()));
    }

    apply_variant(&paks, variant)?;
    let current = detect_variant(root);
    // Tell the in-game controller which balance is active so it can re-skin + swap its
    // Loadout data to match (read by auth_injector from this marker at launch).
    write_hidden_mode(root, &current);
    Ok(current)
}

/// The path of a parked copy of `name` if one exists (`.bak`, or legacy `.1`).
fn parked_path(paks: &Path, name: &str) -> Option<PathBuf> {
    PARK_SUFFIXES
        .iter()
        .map(|s| paks.join(format!("{name}.{s}")))
        .find(|p| p.exists())
}

/// Make `name` the active file: if it's parked and not already active, restore
/// it; if it's already active, drop any stale parked copies (updates can
/// re-deliver the real file while a copy is still parked). No-op when absent.
fn activate(paks: &Path, name: &str) -> AppResult<()> {
    let active = paks.join(name);
    if active.exists() {
        for s in PARK_SUFFIXES {
            let _ = fs::remove_file(paks.join(format!("{name}.{s}")));
        }
    } else if let Some(parked) = parked_path(paks, name) {
        fs::rename(&parked, &active)?;
    }
    Ok(())
}

/// Park `name` out of the way as `<name>.bak`. Windows fs::rename refuses to
/// overwrite, so clear a stale parked copy first; also drop any legacy `.1` so
/// detection stays unambiguous. No-op when the active file isn't present.
fn park(paks: &Path, name: &str) -> AppResult<()> {
    let active = paks.join(name);
    if active.exists() {
        let parked = paks.join(format!("{name}.bak"));
        let _ = fs::remove_file(&parked);
        fs::rename(&active, &parked)?;
    }
    let _ = fs::remove_file(paks.join(format!("{name}.1")));
    Ok(())
}

/// Apply the pak layout for a variant. Only one balance pak is mounted at a
/// time; the rest are parked as `<name>.bak`.
fn apply_variant(paks: &Path, variant: &str) -> AppResult<()> {
    match variant {
        // Production: Elemental Fracture balance active, Playtest parked.
        "ef" => {
            for name in [PAK, SIG] {
                activate(paks, name)?;
            }
            for name in [TEST_PAK, TEST_SIG] {
                park(paks, name)?;
            }
            if !paks.join(PAK).exists() {
                return Err(AppError::new(ErrorCode::VariantPakMissing).with("pak", PAK));
            }
        }
        // Vanilla: both balance paks parked, stock game only.
        "classic" => {
            for name in [PAK, SIG, TEST_PAK, TEST_SIG] {
                park(paks, name)?;
            }
        }
        // Playtest: the playtest balance active, Elemental Fracture parked.
        "playtest" => {
            for name in [PAK, SIG] {
                park(paks, name)?;
            }
            for name in [TEST_PAK, TEST_SIG] {
                activate(paks, name)?;
            }
            if !paks.join(TEST_PAK).exists() {
                return Err(AppError::new(ErrorCode::PlaytestPakMissing).with("pak", TEST_PAK));
            }
        }
        other => return Err(AppError::new(ErrorCode::UnknownVariant).with("variant", other)),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
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
}
