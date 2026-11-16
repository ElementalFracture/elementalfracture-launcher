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
//! granted Modify on the Spellbreak folder, and only that folder, through the
//! security API in this process (no `icacls` or `attrib` child processes, which
//! read as ransomware staging to antivirus). If that needs more rights than the
//! launcher has, the player is asked whether to restart the launcher as
//! administrator for this session (which also runs the game as administrator,
//! since the launcher starts it). Nothing is remembered: the next start is a
//! normal one.

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
/// everything in it, through inheritance), and clear read-only flags inside
/// it. Nothing outside `root` is touched. Returns whether the ACL was written;
/// whether the folder is writable now is checked separately.
#[cfg(windows)]
fn grant_modify(root: &Path) -> bool {
    let ok = win_acl::grant_modify_to_current_user(root);
    clear_read_only(root);
    ok
}

#[cfg(not(windows))]
fn grant_modify(_root: &Path) -> bool {
    false
}

/// Clear the read-only flag on everything under `root`, `root` included.
/// Failures are skipped: the write probe decides afterwards. Only the Windows
/// repair calls it; it is platform-neutral so the test below covers it.
#[cfg_attr(not(windows), allow(dead_code))]
fn clear_read_only(root: &Path) {
    fn visit(dir: &Path) {
        let Ok(entries) = fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(meta) = entry.metadata() else { continue };
            if meta.permissions().readonly() {
                let mut perms = meta.permissions();
                #[allow(clippy::permissions_set_readonly_false)]
                perms.set_readonly(false);
                let _ = fs::set_permissions(&path, perms);
            }
            if meta.is_dir() {
                visit(&path);
            }
        }
    }
    if let Ok(meta) = fs::metadata(root) {
        if meta.permissions().readonly() {
            let mut perms = meta.permissions();
            #[allow(clippy::permissions_set_readonly_false)]
            perms.set_readonly(false);
            let _ = fs::set_permissions(root, perms);
        }
    }
    visit(root);
}

/// The in-process equivalent of `icacls <root> /grant <user>:(OI)(CI)M`: one
/// inheritable allow entry for the account this process runs as, added to
/// the folder's existing DACL. Windows propagates it down the tree.
#[cfg(windows)]
mod win_acl {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::{CloseHandle, LocalFree, HANDLE};
    use windows_sys::Win32::Security::Authorization::{
        GetNamedSecurityInfoW, SetEntriesInAclW, SetNamedSecurityInfoW, EXPLICIT_ACCESS_W, GRANT_ACCESS,
        NO_MULTIPLE_TRUSTEE, SE_FILE_OBJECT, TRUSTEE_IS_SID, TRUSTEE_IS_USER, TRUSTEE_W,
    };
    use windows_sys::Win32::Security::{
        GetTokenInformation, TokenUser, ACL, CONTAINER_INHERIT_ACE, DACL_SECURITY_INFORMATION, OBJECT_INHERIT_ACE,
        PSECURITY_DESCRIPTOR, TOKEN_QUERY, TOKEN_USER,
    };
    use windows_sys::Win32::Storage::FileSystem::{DELETE, FILE_GENERIC_EXECUTE, FILE_GENERIC_READ, FILE_GENERIC_WRITE};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    /// The SID of the account this process runs as, as the raw TOKEN_USER
    /// buffer (the SID pointer points into it).
    fn current_user_token() -> Option<Vec<u8>> {
        // SAFETY: plain Win32 calls on our own process token; the buffer is
        // sized by the first call and owned here.
        unsafe {
            let mut token: HANDLE = null_mut();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
                return None;
            }
            let mut len = 0u32;
            GetTokenInformation(token, TokenUser, null_mut(), 0, &mut len);
            let mut buf = vec![0u8; len as usize];
            let ok = GetTokenInformation(token, TokenUser, buf.as_mut_ptr().cast(), len, &mut len);
            CloseHandle(token);
            (ok != 0 && len as usize <= buf.len()).then_some(buf)
        }
    }

    pub fn grant_modify_to_current_user(root: &Path) -> bool {
        let Some(token) = current_user_token() else { return false };
        let path: Vec<u16> = root.as_os_str().encode_wide().chain(Some(0)).collect();
        // SAFETY: every pointer is either a NUL-terminated buffer or an
        // out-param alive for the call; what the API allocates is LocalFree'd.
        unsafe {
            let sid = (*(token.as_ptr() as *const TOKEN_USER)).User.Sid;
            let mut old_dacl: *mut ACL = null_mut();
            let mut descriptor: PSECURITY_DESCRIPTOR = null_mut();
            if GetNamedSecurityInfoW(
                path.as_ptr(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION,
                null_mut(),
                null_mut(),
                &mut old_dacl,
                null_mut(),
                &mut descriptor,
            ) != 0
            {
                return false;
            }
            let entry = EXPLICIT_ACCESS_W {
                grfAccessPermissions: FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_GENERIC_EXECUTE | DELETE,
                grfAccessMode: GRANT_ACCESS,
                grfInheritance: OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE,
                Trustee: TRUSTEE_W {
                    pMultipleTrustee: null_mut(),
                    MultipleTrusteeOperation: NO_MULTIPLE_TRUSTEE,
                    TrusteeForm: TRUSTEE_IS_SID,
                    TrusteeType: TRUSTEE_IS_USER,
                    ptstrName: sid.cast(),
                },
            };
            let mut new_dacl: *mut ACL = null_mut();
            let ok = SetEntriesInAclW(1, &entry, old_dacl, &mut new_dacl) == 0
                && SetNamedSecurityInfoW(
                    path.as_ptr(),
                    SE_FILE_OBJECT,
                    DACL_SECURITY_INFORMATION,
                    null_mut(),
                    null_mut(),
                    new_dacl,
                    null_mut(),
                ) == 0;
            if !new_dacl.is_null() {
                LocalFree(new_dacl.cast());
            }
            if !descriptor.is_null() {
                LocalFree(descriptor.cast());
            }
            ok
        }
    }
}

/// Look at `path` before the launcher installs to it or runs from it.
///
/// With `fix`, a folder the player can't write to is repaired where possible
/// (see the module docs); with `admin_prompt` as well, a folder that only an
/// administrator can repair asks the player whether to restart as one, for
/// this session only.
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
        if cfg!(windows) && !crate::platform::is_elevated() && ask(&app, &prompt) && crate::platform::relaunch_elevated() {
            out.restarting = true;
            app.exit(0);
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
    fn read_only_flags_are_cleared_down_the_tree() {
        let tmp = tempfile::tempdir().unwrap();
        let deep = tmp.path().join("g3/Content/Paks");
        fs::create_dir_all(&deep).unwrap();
        let file = deep.join("a.pak");
        fs::write(&file, b"x").unwrap();
        for p in [&file, &deep] {
            let mut perms = fs::metadata(p).unwrap().permissions();
            perms.set_readonly(true);
            fs::set_permissions(p, perms).unwrap();
        }
        assert!(fs::metadata(&file).unwrap().permissions().readonly());
        clear_read_only(tmp.path());
        assert!(!fs::metadata(&file).unwrap().permissions().readonly());
        assert!(!fs::metadata(&deep).unwrap().permissions().readonly());
        fs::write(&file, b"y").unwrap();
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
