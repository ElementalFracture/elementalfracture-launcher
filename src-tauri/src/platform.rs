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
pub async fn pick_game_dir(app: tauri::AppHandle, title: Option<String>) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .set_title(title.unwrap_or_else(|| "Select your Spellbreak folder (contains g3 and Engine)".into()))
        .blocking_pick_folder()
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}
