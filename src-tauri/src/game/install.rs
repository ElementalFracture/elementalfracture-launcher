//! Finding a Spellbreak install and reading what's in it.

use std::fs;
use std::path::{Path, PathBuf};

/// The game binary goes by different names depending on the distribution:
/// retail installs ship g3/Binaries/Win64/Spellbreak.exe, the community
/// base archive ships g3-Win64-Test.exe (plus a root-level Spellbreak.exe
/// shim, which we only fall back to if no Win64 binary exists).
pub(crate) const WIN64_EXES: &[&str] = &[
    "Spellbreak.exe",
    "g3-Win64-Test.exe",
    "g3-Win64-Shipping.exe",
    "g3.exe",
];

/// Dropped in the destination folder while the base archive unpacks, and
/// removed once every file has been read back and matched. A folder that
/// still has one was interrupted mid-install: its binary may well be there
/// while half the game isn't.
pub const UNPACKING_MARKER: &str = ".ef-unpacking";

/// Whether `root` (or the folder it was unpacked into, when the archive had a
/// wrapper directory) is an install that never finished unpacking.
pub fn unpack_unfinished(root: &Path) -> bool {
    root.join(UNPACKING_MARKER).exists()
        || root.parent().is_some_and(|p| p.join(UNPACKING_MARKER).exists())
}

/// The game binary under `root`, or None — including for a folder whose
/// install never finished unpacking, which is not an install yet however
/// complete it looks.
pub fn find_exe(root: &Path) -> Option<PathBuf> {
    if unpack_unfinished(root) {
        return None;
    }
    let dir = root.join("g3").join("Binaries").join("Win64");
    for name in WIN64_EXES {
        let p = dir.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    let shim = root.join("Spellbreak.exe");
    shim.exists().then_some(shim)
}

pub fn paks_dir(root: &Path) -> PathBuf {
    root.join("g3").join("Content").join("Paks")
}

/// version.txt from the old launcher is UTF-16LE with a BOM; ours (and the
/// CDN's) may be plain UTF-8. Handle both.
pub fn decode_version_bytes(bytes: &[u8]) -> String {
    let s = if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let units: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&units)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    };
    s.trim_matches(|c: char| c.is_whitespace() || c == '\0').to_string()
}

pub fn read_local_version(root: &Path) -> Option<String> {
    for rel in ["version.txt", "game_version.txt"] {
        if let Ok(b) = fs::read(root.join(rel)) {
            let v = decode_version_bytes(&b);
            if !v.is_empty() { return Some(v); }
        }
    }
    None
}

pub fn read_local_mod_version(root: &Path) -> Option<String> {
    for rel in ["Mods/dlls/mod_version.txt", "Mods/dlls/ef_version.txt", "mod_version.txt", "ef_version.txt"] {
        if let Ok(b) = fs::read(root.join(rel)) {
            let v = decode_version_bytes(&b);
            if !v.is_empty() { return Some(v); }
        }
    }
    None
}

/// True when the balance pak is on disk, active or parked by a channel switch.
///
/// The patch is only half of an install: version.txt can say 6.2.10 while
/// g3/Content/Paks has no ElefracBalance_P.pak at all (a patch that failed
/// midway, a hand-cleaned Paks folder, a game reinstall over the top). Treat
/// that as out of date so the update path re-pulls latest.zip.
pub fn balance_pak_present(root: &Path) -> bool {
    let paks = paks_dir(root);
    ["ElefracBalance_P.pak", "ElefracBalance_P.pak.bak", "ElefracBalance_P.pak.1"]
        .iter()
        .any(|n| paks.join(n).exists())
}

/// Look for an existing Spellbreak install in the usual places.
#[tauri::command]
#[specta::specta]
pub fn auto_find_game() -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    {
        for drive in ["C:", "D:", "E:"] {
            for sub in [
                // Never a Steam or Epic copy: those can't be run as Elemental Fracture (game/folder.rs).
                "\\Program Files\\Spellbreak",
                "\\Games\\Spellbreak",
                "\\Spellbreak",
            ] {
                candidates.push(PathBuf::from(format!("{drive}{sub}")));
            }
        }
    }

    #[cfg(not(windows))]
    {
        if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
            for sub in [
                "Games/Spellbreak",
                ".wine/drive_c/Program Files/Spellbreak",
            ] {
                candidates.push(home.join(sub));
            }
            // Anything directly under ~/Games counts as a candidate too.
            if let Ok(rd) = fs::read_dir(home.join("Games")) {
                for e in rd.flatten() {
                    candidates.push(e.path());
                }
            }
        }
    }

    candidates
        .into_iter()
        .filter(|c| super::store_copy(c).is_none())
        .find(|c| find_exe(c).is_some())
        .map(|p| p.to_string_lossy().into_owned())
}

#[cfg(test)]
#[path = "__tests/install.rs"]
mod tests;
