//! Provisioning the runtime the GAME needs on Linux (Proton via umu-run), as
//! opposed to the one the launcher itself already has.

use super::archive::extract_umu_run;
use super::config::fetch_remote_config;
use super::manifest::fetch_manifest;
use super::progress::emit;
use super::transfer::{discard, download_to_file, http};
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
/// Defensive throughout: it only ever WRITES into its own runtime dir, and it
/// rewrites `launch_command` only when the configured one isn't installed or is
/// plain Wine (no DXVK), so a working Proton or custom setup is left alone.
#[tauri::command]
#[specta::specta]
pub async fn ensure_runtime(app: tauri::AppHandle) -> AppResult<String> {
    if cfg!(windows) {
        return Ok("Windows: no external game runtime is needed.".into());
    }

    let s = settings::load(&app);

    // (a) Already good? A configured wrapper that actually resolves (a bare
    // name on PATH, or an absolute path we provisioned earlier) means there is
    // nothing to do, unless it is plain Wine.
    let configured = s.launch_command.trim();
    let prog = configured.split_whitespace().next().unwrap_or("");
    let plain_wine = game::is_plain_wine(configured);
    if game::command_present(prog) && !plain_wine {
        return Ok(format!("Game runtime already present ({prog}); nothing to set up."));
    }

    // Proton only. Plain Wine has no DXVK, so the game draws through Wine's own
    // Direct3D: characters render flat white and the frame rate collapses. That
    // was a common report, from players whose box had wine but no umu (we used to
    // adopt it) or who had picked wine in Settings. Both are moved to umu-run
    // here, before every launch: a system umu-run first, then one we provisioned
    // earlier, then a fresh download.
    if game::command_present("umu-run") {
        settings::mutate(&app, |s| s.launch_command = "umu-run".into())?;
        return Ok(if plain_wine {
            "Switched the game from plain Wine to umu-run (Proton), which includes DXVK.".into()
        } else {
            "Using the runtime already installed: umu-run.".into()
        });
    }

    use tauri::Manager;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::detail(ErrorCode::NoAppDataDir, e))?;
    let runtime_dir = data_dir.join("runtime");
    let umu_run = runtime_dir.join("umu-run");
    if umu_run.exists() {
        let path = umu_run.to_string_lossy().into_owned();
        settings::mutate(&app, |s| s.launch_command = path.clone())?;
        return Ok(format!("Using the umu runtime installed earlier ({path})."));
    }

    // (b) No Proton yet: provision umu-run. It's a python zipapp, so the host
    // needs python3 (which nearly every desktop Linux ships by default). Without
    // it, a working plain Wine is still better than no game at all, so it is kept
    // and the message says what to install; with nothing at all, fail clearly
    // rather than download something that can't run.
    if !game::command_present("python3") {
        if plain_wine && game::command_present(prog) {
            return Ok("Running on plain Wine without DXVK: the game will look wrong and run slowly. \
                       Install python3 so the launcher can set up Proton."
                .into());
        }
        return Err(AppError::new(ErrorCode::RuntimeNeedsPython));
    }

    fs::create_dir_all(&runtime_dir)?;

    // Allow the CDN to redirect the runtime URL without shipping a new launcher.
    // The redirect buys nothing on its own: whatever the URL, the tarball has
    // to hash to the manifest's `runtime/<file name>` entry, so a config.ini
    // pointing at a hostile build is refused the same as a swapped one.
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let client = http()?;
    let url = fetch_remote_config(&client, &cdn)
        .await
        .get("umu_zipapp_url")
        .filter(|u| u.starts_with("https://"))
        .cloned()
        .unwrap_or_else(|| UMU_ZIPAPP_URL.to_string());
    let manifest = fetch_manifest(&app, &client, &cdn).await?;
    let key = format!("runtime/{}", url.rsplit('/').next().unwrap_or(""));

    emit(&app, "runtime", "Downloading game runtime (umu)…".into(), 0.0, 0, 0);
    let tar_path = runtime_dir.join("umu-launcher-zipapp.tar");
    download_to_file(&app, "runtime", &url, &tar_path, manifest.hash_for(&key)?).await?;

    emit(&app, "runtime", "Installing game runtime…".into(), 0.0, 0, 0);
    let (tar2, umu2) = (tar_path.clone(), umu_run.clone());
    tauri::async_runtime::spawn_blocking(move || extract_umu_run(&tar2, &umu2))
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    discard(&tar_path);

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
