//! The launcher replacing itself: what it compares against, and the swap.

use super::config::fetch_remote_launcher_version;
use super::transfer::{download_to_file, http};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

/// The version marker written after a successful self-update. Guards
/// against a re-prompt loop when the downloaded binary still reports an
/// older compiled-in version.
fn launcher_version_marker(app: &tauri::AppHandle) -> PathBuf {
    settings::config_dir(app).join("launcher_version.txt")
}

/// What a self-update actually replaces, and the CDN file it pulls.
/// A plain binary swaps itself; an AppImage's mount is read-only, so we
/// swap the .AppImage file it was launched from ($APPIMAGE, set by the
/// AppImage runtime).
fn update_target() -> AppResult<(PathBuf, &'static str)> {
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
        return Ok((PathBuf::from(appimage), "ef-launcher.AppImage"));
    }
    let exe = std::env::current_exe()?;
    Ok((exe, if cfg!(windows) { "ef-launcher.exe" } else { "ef-launcher" }))
}

#[derive(Serialize, specta::Type)]
pub struct LauncherUpdateInfo {
    pub current: String,
    pub remote: Option<String>,
    pub update: bool,
    /// False when this build doesn't ask the CDN about itself at all, so the
    /// UI can say "off in this build" rather than "couldn't reach the server".
    pub checked: bool,
}

/// True when `EF_LAUNCHER_UPDATE` is set to something meant as "yes".
fn opt_in(value: Option<&str>) -> bool {
    matches!(value, Some(v) if !v.is_empty() && v != "0")
}

/// Whether this build consults the CDN about a newer launcher.
///
/// Debug builds don't: their compiled-in version trails every release, so a
/// `tauri dev` session would come up behind the blocking update modal every
/// time — and the binary a self-update would swap is the one cargo just built.
/// Nothing is requested from the CDN either, which is the point: a dev profile
/// aims `cdn_base` at the live one by default.
///
/// `EF_LAUNCHER_UPDATE=1` turns the check back on for a session that means to
/// drive it; point `cdn_base` at the test env first (test-env/README.md).
fn self_update_checked() -> bool {
    !cfg!(debug_assertions) || opt_in(std::env::var("EF_LAUNCHER_UPDATE").ok().as_deref())
}

/// Compare this launcher against {cdn}/launcher/version.txt. Also cleans up
/// the .old binary a previous self-update left behind.
#[tauri::command]
#[specta::specta]
pub async fn get_launcher_update(app: tauri::AppHandle) -> LauncherUpdateInfo {
    if let Ok((target, _)) = update_target() {
        let _ = fs::remove_file(target.with_extension("old"));
    }

    let current = env!("CARGO_PKG_VERSION").to_string();
    if !self_update_checked() {
        return LauncherUpdateInfo { current, remote: None, update: false, checked: false };
    }

    let s = settings::load(&app);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let remote = match http() {
        Ok(client) => fetch_remote_launcher_version(&client, &cdn).await,
        Err(_) => None,
    };
    let installed = fs::read_to_string(launcher_version_marker(&app))
        .ok()
        .map(|v| v.trim().to_string());

    let update = matches!(
        &remote,
        Some(r) if *r != current && installed.as_deref() != Some(r.as_str())
    );
    LauncherUpdateInfo { current, remote, update, checked: true }
}

/// Self-update: pull the new binary from the CDN, swap it in place of the
/// running one (rename the live exe aside first, Windows allows that but
/// not overwriting), bump the local version marker, restart.
#[tauri::command]
#[specta::specta]
pub async fn update_launcher(app: tauri::AppHandle) -> AppResult<()> {
    // The check being off means the binary under us is a local build; swapping
    // it for a CDN one would throw away what cargo just produced.
    if !self_update_checked() {
        return Err(AppError::new(ErrorCode::LauncherUpdateDisabledInDev));
    }

    let s = settings::load(&app);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let remote = fetch_remote_launcher_version(&http()?, &cdn)
        .await
        .ok_or_else(|| AppError::new(ErrorCode::LauncherVersionUnreadable))?;

    let (exe, binary) = update_target()?;
    let staged = exe.with_extension("new");
    download_to_file(&app, "download-launcher", &format!("{cdn}/launcher/{binary}"), &staged).await?;

    let size = fs::metadata(&staged).map(|m| m.len()).unwrap_or(0);
    if size < 1024 * 1024 {
        let _ = fs::remove_file(&staged);
        return Err(AppError::new(ErrorCode::LauncherArchiveTooSmall));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&staged, fs::Permissions::from_mode(0o755));
    }

    let parked = exe.with_extension("old");
    let _ = fs::remove_file(&parked);
    fs::rename(&exe, &parked).map_err(|e| AppError::detail(ErrorCode::LauncherStageFailed, e))?;
    if let Err(e) = fs::rename(&staged, &exe) {
        let _ = fs::rename(&parked, &exe); // roll back so the install stays runnable
        return Err(AppError::detail(ErrorCode::LauncherInstallFailed, e));
    }

    let _ = fs::write(launcher_version_marker(&app), &remote);

    std::process::Command::new(&exe)
        .spawn()
        .map_err(|e| AppError::detail(ErrorCode::LauncherRestartFailed, e))?;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
#[path = "__tests/self_update.rs"]
mod tests;
