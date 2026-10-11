//! The machine the launcher is running on, as opposed to the game on it.
//!
//! Dev builds run inside a distrobox, where the browser, the file dialog and
//! wine all live on the *host* — so anything that hands work to a program
//! outside our own process goes through here rather than assuming it can just
//! spawn it.

use crate::error::{AppError, AppResult, ErrorCode};

/// True when the launcher itself runs inside a container (distrobox dev
/// builds) — programs like the browser or wine live on the host there.
#[cfg(target_os = "linux")]
pub fn in_container() -> bool {
    std::path::Path::new("/run/.containerenv").exists()
        || std::path::Path::new("/.dockerenv").exists()
        || std::env::var_os("container").is_some()
}

#[cfg(not(target_os = "linux"))]
pub fn in_container() -> bool {
    false
}

/// When in a container, xdg-open would look for a browser inside the
/// container and silently fail. Hand the URL to the host instead.
#[cfg(target_os = "linux")]
fn host_open(url: &str) -> bool {
    if !in_container() {
        return false;
    }
    for prog in ["distrobox-host-exec", "flatpak-spawn"] {
        let mut cmd = std::process::Command::new(prog);
        if prog == "flatpak-spawn" {
            cmd.arg("--host");
        }
        cmd.arg("xdg-open")
            .arg(url)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        if cmd.spawn().is_ok() {
            return true;
        }
    }
    false
}

#[cfg(not(target_os = "linux"))]
fn host_open(_url: &str) -> bool {
    false
}

#[tauri::command]
#[specta::specta]
pub fn open_url(url: String) -> AppResult<()> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(AppError::new(ErrorCode::UnsupportedLinkScheme));
    }
    if host_open(&url) {
        return Ok(());
    }
    open::that_detached(&url)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn pick_game_dir(app: tauri::AppHandle, title: Option<String>, start_dir: Option<String>) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app
        .dialog()
        .file()
        .set_title(title.unwrap_or_else(|| "Select your Spellbreak folder (contains g3 and Engine)".into()));
    // Without a start folder Windows opens Documents, which OneDrive usually owns (game/folder.rs).
    if let Some(dir) = start_dir.filter(|d| std::path::Path::new(d).is_dir()) {
        dialog = dialog.set_directory(dir);
    }
    dialog
        .blocking_pick_folder()
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

/// True when this process runs elevated (as administrator). Always false off Windows.
#[cfg(windows)]
pub fn is_elevated() -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    // SAFETY: plain Win32 calls on our own process token; the out-buffer is a TOKEN_ELEVATION we own.
    unsafe {
        let mut token: HANDLE = std::ptr::null_mut();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) == 0 {
            return false;
        }
        let mut elev = TOKEN_ELEVATION { TokenIsElevated: 0 };
        let mut len = 0u32;
        let ok = GetTokenInformation(
            token,
            TokenElevation,
            &mut elev as *mut _ as *mut _,
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut len,
        );
        CloseHandle(token);
        ok != 0 && elev.TokenIsElevated != 0
    }
}

#[cfg(not(windows))]
pub fn is_elevated() -> bool {
    false
}

/// Start another copy of the launcher as administrator (Windows asks the player through UAC). True when it
/// started; the caller then exits this one. False when the player said no, or off Windows.
#[cfg(windows)]
pub fn relaunch_elevated() -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let Ok(exe) = std::env::current_exe() else { return false };
    let wide = |s: &std::ffi::OsStr| s.encode_wide().chain(Some(0)).collect::<Vec<u16>>();
    let verb = wide(std::ffi::OsStr::new("runas"));
    let file = wide(exe.as_os_str());
    let dir = exe.parent().map(|d| wide(d.as_os_str()));
    // SAFETY: every pointer is a NUL-terminated buffer alive for the call.
    let r = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            dir.as_ref().map_or(std::ptr::null(), |d| d.as_ptr()),
            SW_SHOWNORMAL,
        )
    };
    r as isize > 32
}

#[cfg(not(windows))]
pub fn relaunch_elevated() -> bool {
    false
}

/// Whether the launcher is running as administrator (the Settings toggle shows it).
#[tauri::command]
#[specta::specta]
pub fn launcher_elevated() -> bool {
    is_elevated()
}

/// Bytes this user may still write on the filesystem holding `path` — what
/// the OS will actually hand out, not the raw free count (ext4 keeps 5% back
/// for root, and a quota can cap it lower still).
#[cfg(unix)]
pub fn free_space(path: &std::path::Path) -> std::io::Result<u64> {
    use std::os::unix::ffi::OsStrExt;
    let c = std::ffi::CString::new(path.as_os_str().as_bytes())?;
    // SAFETY: statvfs only writes into the struct we hand it, and `c` is a
    // valid NUL-terminated path for the length of the call.
    let mut st: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c.as_ptr(), &mut st) } != 0 {
        return Err(std::io::Error::last_os_error());
    }
    // The field widths differ between unixes; on Linux these casts are no-ops.
    #[allow(clippy::unnecessary_cast)]
    Ok((st.f_bavail as u64).saturating_mul(st.f_frsize as u64))
}

#[cfg(windows)]
pub fn free_space(path: &std::path::Path) -> std::io::Result<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut available = 0u64;
    // SAFETY: `wide` is NUL-terminated and outlives the call; the two totals
    // we don't want are allowed to be null.
    let ok = unsafe {
        GetDiskFreeSpaceExW(wide.as_ptr(), &mut available, std::ptr::null_mut(), std::ptr::null_mut())
    };
    if ok == 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(available)
}

#[cfg(test)]
#[path = "__tests/platform.rs"]
mod tests;
