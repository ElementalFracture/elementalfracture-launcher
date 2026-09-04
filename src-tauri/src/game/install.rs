//! Finding a Spellbreak install and reading what's in it.

use std::fs;
use std::path::{Path, PathBuf};

/// The game binary goes by different names depending on the distribution:
/// retail installs ship g3/Binaries/Win64/Spellbreak.exe, the community
/// base archive ships g3-Win64-Test.exe (plus a root-level Spellbreak.exe
/// shim, which we only fall back to if no Win64 binary exists).
pub(super) const WIN64_EXES: &[&str] = &[
    "Spellbreak.exe",
    "g3-Win64-Test.exe",
    "g3-Win64-Shipping.exe",
    "g3.exe",
];

pub fn find_exe(root: &Path) -> Option<PathBuf> {
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
    let v = decode_version_bytes(&fs::read(root.join("version.txt")).ok()?);
    (!v.is_empty()).then_some(v)
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
                "\\Program Files\\Spellbreak",
                "\\Program Files\\Epic Games\\Spellbreak",
                "\\Program Files (x86)\\Epic Games\\Spellbreak",
                "\\Program Files (x86)\\Steam\\steamapps\\common\\Spellbreak",
                "\\SteamLibrary\\steamapps\\common\\Spellbreak",
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
                ".local/share/Steam/steamapps/common/Spellbreak",
                ".steam/steam/steamapps/common/Spellbreak",
                ".wine/drive_c/Program Files/Spellbreak",
                ".wine/drive_c/Program Files/Epic Games/Spellbreak",
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
        .find(|c| find_exe(c).is_some())
        .map(|p| p.to_string_lossy().into_owned())
}
