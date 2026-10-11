//! Is this folder somewhere Elemental Fracture can run from?
//!
//! Three things have kept players on an old game while the launcher said they
//! were up to date:
//!
//! * **A Steam or Epic copy of Spellbreak.** Those stores own their folders:
//!   they verify and restore their own files, and the store starts its own exe.
//!   Elemental Fracture installs and runs its own copy instead.
//! * **A folder inside OneDrive.** Windows puts Documents and Desktop in
//!   OneDrive, so that's where a folder picker opens. OneDrive locks files while
//!   it syncs them and puts cloud copies back over newer ones, so updates don't
//!   stick there.
//! * **A folder the player's account can't write to** (Program Files, a folder
//!   another account made). The launcher's writes fail, and the game keeps
//!   loading the files that were already there.
//!
//! `check_game_folder` reports which one applies. A folder that can't be
//! written to is fixed in place where possible: the player's own account is
//! granted Modify on the Spellbreak folder, and only that folder. If that needs
//! more rights than the launcher has, the player is asked once whether to run
//! the launcher as administrator from now on (which also runs the game as
//! administrator, since the launcher starts it).

use crate::settings;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, specta::Type, Clone, Debug, Default)]
pub struct FolderCheck {
    /// "ok" | "storeCopy" | "oneDrive" | "notWritable"
    pub verdict: String,
    /// For "storeCopy": "steam" | "epic".
    pub store: Option<String>,
    /// For "notWritable": the folder that refused a write, and why.
    pub path: Option<String>,
    pub detail: Option<String>,
    /// The folder's permissions were changed so the player's account can write
    /// to it (and now it can).
    pub fixed: bool,
    /// The launcher is restarting as administrator; the UI has nothing left to do.
    pub restarting: bool,
}

/// The question asked before restarting as administrator, in the player's
/// language (the backend holds no prose; see error.rs).
#[derive(Deserialize, specta::Type, Clone, Debug)]
pub struct AdminPrompt {
    pub title: String,
    pub message: String,
}

impl FolderCheck {
    fn verdict(v: &str) -> Self {
        FolderCheck { verdict: v.into(), ..Default::default() }
    }
}

/// "steam" or "epic" when `root` is that store's copy of Spellbreak.
pub fn store_copy(root: &Path) -> Option<&'static str> {
    let lower = root.to_string_lossy().to_lowercase().replace('\\', "/");
    if lower.contains("/steamapps/") || lower.ends_with("/steamapps") {
        return Some("steam");
    }
    // Epic keeps its install manifest in .egstore inside the game folder.
    if root.join(".egstore").is_dir() || lower.contains("/epic games/") {
        return Some("epic");
    }
    None
}

/// True when `path` is inside a OneDrive folder.
pub fn in_onedrive(path: &Path) -> bool {
    let lower = path.to_string_lossy().to_lowercase().replace('\\', "/");
    let mut roots: Vec<String> = ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]
        .iter()
        .filter_map(|k| std::env::var(k).ok())
        .filter(|v| !v.trim().is_empty())
        .map(|v| v.to_lowercase().replace('\\', "/").trim_end_matches('/').to_string())
        .collect();
    roots.dedup();
    if roots.iter().any(|r| lower == *r || lower.starts_with(&format!("{r}/"))) {
        return true;
    }
    // Not signed in to this account's OneDrive, but the folder still sits in
    // one ("C:\Users\x\OneDrive - Contoso\...").
    lower.split('/').any(|n| n == "onedrive" || n.starts_with("onedrive - "))
}

/// The folders the launcher writes into, as far as they exist yet.
fn write_targets(root: &Path) -> Vec<PathBuf> {
    let mut out = vec![root.to_path_buf()];
    for sub in ["g3/Binaries/Win64", "g3/Content/Paks", "Mods", "Mods/dlls"] {
        let p = root.join(sub);
        if p.is_dir() {
            out.push(p);
        }
    }
    out
}

/// Write, read back and remove a small file in each folder the launcher writes
/// into. The first folder that refuses, with the system's reason.
fn first_unwritable(root: &Path) -> Option<(PathBuf, String)> {
    for dir in write_targets(root) {
        let probe = dir.join(".ef_write_probe");
        let res = fs::write(&probe, b"ef").and_then(|_| fs::read(&probe)).and_then(|b| {
            if b == b"ef" {
                Ok(())
            } else {
                Err(std::io::Error::other("the file read back differently"))
            }
        });
        let _ = fs::remove_file(&probe);
        if let Err(e) = res {
            return Some((dir, e.to_string()));
        }
    }
    None
}

/// Give the signed-in Windows account Modify on the Spellbreak folder (and
/// everything in it), and clear read-only flags inside it. Nothing outside
/// `root` is touched. Returns whether the commands ran without error; whether
/// the folder is writable now is checked separately.
#[cfg(windows)]
fn grant_modify(root: &Path) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let user = match (std::env::var("USERDOMAIN"), std::env::var("USERNAME")) {
        (Ok(d), Ok(u)) if !d.is_empty() => format!("{d}\\{u}"),
        (_, Ok(u)) => u,
        _ => return false,
    };
    let ok = std::process::Command::new("icacls")
        .arg(root)
        .arg("/grant")
        .arg(format!("{user}:(OI)(CI)M"))
        .args(["/T", "/C", "/Q"])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    let _ = std::process::Command::new("attrib")
        .arg("-R")
        .arg(root.join("*"))
        .args(["/S", "/D"])
        .creation_flags(CREATE_NO_WINDOW)
        .status();
    ok
}

#[cfg(not(windows))]
fn grant_modify(_root: &Path) -> bool {
    false
}

/// Look at `path` before the launcher installs to it or runs from it.
///
/// With `fix`, a folder the player can't write to is repaired where possible
/// (see the module docs); with `admin_prompt` as well, a folder that only an
/// administrator can repair asks the player whether to restart as one.
#[tauri::command]
#[specta::specta]
pub async fn check_game_folder(
    app: tauri::AppHandle,
    path: String,
    fix: bool,
    admin_prompt: Option<AdminPrompt>,
) -> FolderCheck {
    let root = PathBuf::from(path.trim());
    if let Some(store) = store_copy(&root) {
        return FolderCheck { store: Some(store.into()), ..FolderCheck::verdict("storeCopy") };
    }
    if in_onedrive(&root) {
        return FolderCheck::verdict("oneDrive");
    }
    if !root.is_dir() {
        // Nothing there yet (a download destination): its parent decides.
        return match root.parent().filter(|p| p.is_dir()).and_then(first_unwritable) {
            None => FolderCheck::verdict("ok"),
            Some((dir, why)) => FolderCheck {
                path: Some(dir.to_string_lossy().into_owned()),
                detail: Some(why),
                ..FolderCheck::verdict("notWritable")
            },
        };
    }
    let Some((dir, why)) = first_unwritable(&root) else {
        return FolderCheck::verdict("ok");
    };
    let mut out = FolderCheck {
        path: Some(dir.to_string_lossy().into_owned()),
        detail: Some(why),
        ..FolderCheck::verdict("notWritable")
    };
    if !fix {
        return out;
    }
    if grant_modify(&root) && first_unwritable(&root).is_none() {
        return FolderCheck { fixed: true, ..FolderCheck::verdict("ok") };
    }
    if first_unwritable(&root).is_none() {
        return FolderCheck { fixed: true, ..FolderCheck::verdict("ok") };
    }
    if let Some(prompt) = admin_prompt {
        if cfg!(windows) && !crate::platform::is_elevated() && ask(&app, &prompt) {
            let mut s = settings::load(&app);
            s.run_as_admin = true;
            let _ = settings::store(&app, &s);
            if crate::platform::relaunch_elevated() {
                out.restarting = true;
                app.exit(0);
            }
        }
    }
    out
}

fn ask(app: &tauri::AppHandle, p: &AdminPrompt) -> bool {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
    app.dialog()
        .message(&p.message)
        .title(&p.title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancel)
        .blocking_show()
}

/// Where the Download folder picker opens. On Windows: a Spellbreak folder beside the launcher
/// (the installer puts it per-user in AppData\Local\Programs, which the player
/// can always write to and OneDrive never syncs; uninstalling the launcher
/// leaves a game inside it alone), else `C:\Games` when the launcher sits
/// somewhere it can't write. Elsewhere `~/Games` (an AppImage runs from a
/// read-only mount). Created if missing; None if it can't be.
#[tauri::command]
#[specta::specta]
pub fn suggested_install_dir() -> Option<String> {
    #[cfg(windows)]
    {
        // A Spellbreak folder of its own beside the exe, so the game's files don't mix with the launcher's.
        let beside = std::env::current_exe().ok().and_then(|e| e.parent().map(|d| d.join("Spellbreak")));
        if let Some(dir) = beside.filter(|d| !in_onedrive(d) && fs::create_dir_all(d).is_ok() && first_unwritable(d).is_none()) {
            return Some(dir.to_string_lossy().into_owned());
        }
        let dir = PathBuf::from(format!("{}\\Games", std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into())));
        fs::create_dir_all(&dir).ok()?;
        Some(dir.to_string_lossy().into_owned())
    }
    #[cfg(not(windows))]
    {
        let dir = PathBuf::from(std::env::var_os("HOME")?).join("Games");
        fs::create_dir_all(&dir).ok()?;
        Some(dir.to_string_lossy().into_owned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn steam_and_epic_copies_are_recognised() {
        assert_eq!(store_copy(Path::new("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Spellbreak")), Some("steam"));
        assert_eq!(store_copy(Path::new("D:\\SteamLibrary\\steamapps\\common\\Spellbreak")), Some("steam"));
        assert_eq!(store_copy(Path::new("C:\\Program Files\\Epic Games\\Spellbreak")), Some("epic"));
        assert_eq!(store_copy(Path::new("C:\\Games\\Spellbreak")), None);
    }

    #[test]
    fn onedrive_folders_are_recognised_by_name() {
        assert!(in_onedrive(Path::new("C:\\Users\\a\\OneDrive\\Documents\\Spellbreak")));
        assert!(in_onedrive(Path::new("C:\\Users\\a\\OneDrive - Contoso\\Spellbreak")));
        assert!(!in_onedrive(Path::new("C:\\Games\\Spellbreak")));
    }

    #[test]
    fn a_writable_folder_passes_the_probe() {
        let dir = std::env::temp_dir().join(format!("ef_probe_{}", std::process::id()));
        fs::create_dir_all(dir.join("Mods/dlls")).unwrap();
        assert!(first_unwritable(&dir).is_none());
        assert!(!dir.join(".ef_write_probe").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
