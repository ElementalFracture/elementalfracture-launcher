//! Provisioning the runtime the GAME needs on Linux (Proton via umu-run), as
//! opposed to the one the launcher itself already has.

use super::archive::extract_umu_run;
use super::config::fetch_remote_config;
use super::progress::emit;
use super::transfer::{download_to_file, http};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{game, settings};
use std::fs;

/// The self-contained umu-run zipapp we provision when a Linux box has no game
/// runtime at all. It's a single python zipapp that bundles its own deps (only
/// system python3 is required) and, crucially, auto-downloads a Proton build
/// on first launch when PROTONPATH is unset, so provisioning umu alone is
/// enough (no separate GE-Proton download needed). Pinned to a known-good
/// release because the asset name carries the version (the GitHub
/// latest/download redirect can't target a versioned name); overridable from
/// the CDN config.ini key `umu_zipapp_url` without shipping a new launcher.
const UMU_ZIPAPP_URL: &str =
    "https://github.com/Open-Wine-Components/umu-launcher/releases/download/1.4.4/umu-launcher-1.4.4-zipapp.tar";

/// Ensure a usable Linux game runtime exists before launch.
///
/// The launcher ships as an AppImage that runs on its own, but the GAME needs
/// Proton (via umu-run) or Wine to run. This is a no-op on Windows and on any
/// machine that already has a runtime (CachyOS / Bazzite ship umu + GE-Proton,
/// so they skip cleanly). Otherwise it provisions the self-contained umu-run
/// zipapp into the launcher's own data dir (no root, no Steam) and points
/// `launch_command` at it; umu-run then auto-downloads Proton on first launch.
///
/// Defensive throughout: it only ever WRITES into its own runtime dir and only
/// rewrites `launch_command` when the configured one isn't actually installed,
/// so it never touches or corrupts an existing runtime.
#[tauri::command]
#[specta::specta]
pub async fn ensure_runtime(app: tauri::AppHandle) -> AppResult<String> {
    if cfg!(windows) {
        return Ok("Windows: no external game runtime is needed.".into());
    }

    let s = settings::load(&app);

    // (a) Already good? A configured wrapper that actually resolves (a bare
    // name on PATH, or an absolute path we provisioned earlier) means there is
    // nothing to do.
    let configured = s.launch_command.trim();
    let prog = configured.split_whitespace().next().unwrap_or("");
    if game::command_present(prog) {
        return Ok(format!("Game runtime already present ({prog}); nothing to set up."));
    }

    // The configured wrapper is missing. Adopt any real runtime that IS on the
    // system before downloading anything, preferring umu-run (Proton) over
    // plain Wine. This also self-heals the default "umu-run" config on a box
    // that only has wine, and vice-versa.
    for cand in ["umu-run", "wine", "wine64", "wine-stable"] {
        if game::command_present(cand) {
            settings::mutate(&app, |s| s.launch_command = cand.into())?;
            return Ok(format!("Using the runtime already installed: {cand}."));
        }
    }

    // (b) Nothing usable is installed — provision umu-run. It's a python
    // zipapp, so the host needs python3 (which nearly every desktop Linux ships
    // by default). Fail with a clear, actionable message if it's genuinely
    // absent rather than downloading something that can't run.
    if !game::command_present("python3") {
        return Err(AppError::new(ErrorCode::RuntimeNeedsPython));
    }

    use tauri::Manager;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::detail(ErrorCode::NoAppDataDir, e))?;
    let runtime_dir = data_dir.join("runtime");
    fs::create_dir_all(&runtime_dir)?;
    let umu_run = runtime_dir.join("umu-run");

    // Allow the CDN to redirect the runtime URL without shipping a new launcher.
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let url = match http() {
        Ok(client) => fetch_remote_config(&client, &cdn)
            .await
            .get("umu_zipapp_url")
            .filter(|u| u.starts_with("https://"))
            .cloned()
            .unwrap_or_else(|| UMU_ZIPAPP_URL.to_string()),
        Err(_) => UMU_ZIPAPP_URL.to_string(),
    };

    emit(&app, "runtime", "Downloading game runtime (umu)…".into(), 0.0, 0, 0);
    let tar_path = runtime_dir.join("umu-launcher-zipapp.tar");
    download_to_file(&app, "runtime", &url, &tar_path).await?;

    emit(&app, "runtime", "Installing game runtime…".into(), 0.0, 0, 0);
    let (tar2, umu2) = (tar_path.clone(), umu_run.clone());
    tauri::async_runtime::spawn_blocking(move || extract_umu_run(&tar2, &umu2))
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    let _ = fs::remove_file(&tar_path);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&umu_run, fs::Permissions::from_mode(0o755))
            .map_err(|e| AppError::detail(ErrorCode::RuntimeNotExecutable, e))?;
    }

    // Point the launcher at the runtime we just installed. An absolute path is
    // matched by launch_game's `contains("umu")` Proton branch and by
    // command_present's absolute-path check, so the next launch just works.
    let path = umu_run.to_string_lossy().into_owned();
    settings::mutate(&app, |s| s.launch_command = path.clone())?;

    emit(&app, "done", "Game runtime ready".into(), 100.0, 0, 0);
    Ok(format!(
        "Installed the umu runtime to {path}. Proton downloads automatically on first launch."
    ))
}
