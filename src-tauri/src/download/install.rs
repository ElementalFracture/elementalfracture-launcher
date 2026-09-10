//! Putting the game on disk and keeping it level with the CDN: the fresh
//! install, the balance patch, the playtest channel, and the version readout
//! the update badge hangs off.

use super::archive::{extract_all, extract_flat, stage_test_pak};
use super::config::fetch_remote_game_version;
use super::progress::emit;
use super::runtime::ensure_runtime;
use super::transfer::{download_to_file, http};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{game, settings};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// Bring an install in agreement with the CDN: fetch the latest version,
/// pull the balance patch into g3/Content/Paks, install the mod package,
/// and only once BOTH have landed bump the local version.txt to match —
/// a half-provisioned install keeps looking outdated and gets retried.
/// Shared by fresh installs, manual updates, newly-pointed-at game folders,
/// and the automatic startup update check.
async fn apply_patch(app: &tauri::AppHandle, cdn: &str, root: &Path) -> AppResult<String> {
    let paks = game::paks_dir(root);
    if !paks.is_dir() {
        return Err(AppError::new(ErrorCode::PaksNotFound).with("path", paks.display()));
    }

    let remote_version = fetch_remote_game_version(&http()?, cdn).await;

    let tmp = root.join("_efpatch.zip");
    download_to_file(app, "download-patch", &format!("{cdn}/patch/latest.zip"), &tmp).await?;

    emit(app, "extract-patch", "Installing patch…".into(), 0.0, 0, 0);
    let (tmp2, paks2) = (tmp.clone(), paks.clone());
    let names = tauri::async_runtime::spawn_blocking(move || extract_flat(&tmp2, &paks2))
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    let _ = fs::remove_file(&tmp);
    if !game::balance_pak_present(root) {
        return Err(AppError::new(ErrorCode::PatchPakMissing)
            .with("paks", paks.display())
            .with("delivered", names.join(", ")));
    }
    emit(app, "extract-patch", format!("Patch installed ({} files)", names.len()), 100.0, 0, 0);

    emit(app, "install-mods", "Downloading mod package…".into(), 0.0, 0, 0);
    let mod_log = crate::mods::fetch_and_install(cdn, root.to_path_buf()).await?;
    let installed = mod_log.iter().filter(|l| l.starts_with("Installed")).count();
    emit(app, "install-mods", format!("Mods installed ({installed} files)"), 100.0, 0, 0);

    // The install now matches the CDN — bump version.txt to say so.
    match remote_version {
        Some(v) => {
            fs::write(root.join("version.txt"), &v)
                .map_err(|e| AppError::detail(ErrorCode::PatchVersionWriteFailed, e))?;
            Ok(v)
        }
        None => Ok("unknown".into()),
    }
}

/// Fresh install: base game zip → dest, then patch + version bump.
#[tauri::command]
#[specta::specta]
pub async fn download_game(app: tauri::AppHandle, dest: String) -> AppResult<String> {
    let s = settings::load(&app);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let dest = PathBuf::from(dest);
    fs::create_dir_all(&dest)?;

    let tmp_zip = dest.join("_elefracbase.zip.part");
    emit(&app, "download-base", "Starting download…".into(), 0.0, 0, 0);
    download_to_file(&app, "download-base", &format!("{cdn}/game/elefracbase.zip"), &tmp_zip).await?;

    let (app2, dest2, zip2) = (app.clone(), dest.clone(), tmp_zip.clone());
    tauri::async_runtime::spawn_blocking(move || extract_all(&app2, "extract-base", &zip2, &dest2))
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    let _ = fs::remove_file(&tmp_zip);

    // The zip may either contain g3/Engine at its root or a single wrapper dir.
    let root = if dest.join("g3").is_dir() {
        dest.clone()
    } else {
        fs::read_dir(&dest)?
            .flatten()
            .map(|e| e.path())
            .find(|p| p.join("g3").is_dir())
            .ok_or_else(|| AppError::new(ErrorCode::ArchiveMissingGameFolder))?
    };

    apply_patch(&app, &cdn, &root).await?;

    let mut s = settings::load(&app);
    s.game_path = root.to_string_lossy().into_owned();
    settings::store(&app, &s)?;

    // Provision a game runtime as part of the install so first launch just
    // works. Best-effort: a fresh install shouldn't be reported as failed just
    // because the runtime couldn't be set up (e.g. no python3) — the launch
    // path re-runs this and surfaces the same message then.
    if let Err(e) = ensure_runtime(app.clone()).await {
        emit(&app, "runtime", format!("Runtime setup skipped: {e}"), 100.0, 0, 0);
    }

    emit(&app, "done", "Installation complete".into(), 100.0, 0, 0);
    Ok(s.game_path)
}

/// Re-apply the latest balance patch to an existing install.
#[tauri::command]
#[specta::specta]
pub async fn update_patch(app: tauri::AppHandle) -> AppResult<String> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let version = apply_patch(&app, &cdn, Path::new(&s.game_path)).await?;
    emit(&app, "done", "Update complete".into(), 100.0, 0, 0);
    Ok(version)
}

#[derive(Serialize, specta::Type)]
pub struct VersionInfo {
    pub local: Option<String>,
    pub remote: Option<String>,
}

/// Installed vs latest version, for the update badge.
#[tauri::command]
#[specta::specta]
pub async fn get_versions(app: tauri::AppHandle) -> VersionInfo {
    let s = settings::load(&app);
    let root = Path::new(&s.game_path);
    // An install missing its balance pak is out of date no matter what
    // version.txt says, so reporting no local version lights the update badge.
    let local = (!s.game_path.is_empty() && game::balance_pak_present(root))
        .then(|| game::read_local_version(root))
        .flatten();

    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let remote = match http() {
        Ok(client) => fetch_remote_game_version(&client, &cdn).await,
        Err(_) => None,
    };
    VersionInfo { local, remote }
}

/// Download the Playtest balance pak, stage it as ElefracTest_P.pak beside the
/// production pak, then switch the game onto it (which parks the Elemental
/// Fracture pak). Gated in the UI behind the Tester badge; the CDN path is
/// unlisted rather than access-controlled.
///
/// The CDN key stays `patch/dev.zip` — it's what the server publishes, and the
/// staged file keeps its `ElefracTest_P` name for installs that already have
/// one. Only what the launcher calls the channel changed.
#[tauri::command]
#[specta::specta]
pub async fn install_playtest_build(app: tauri::AppHandle) -> AppResult<String> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let root = PathBuf::from(&s.game_path);
    let paks = game::paks_dir(&root);
    if !paks.is_dir() {
        return Err(AppError::new(ErrorCode::PaksNotFound).with("path", paks.display()));
    }
    let cdn = s.cdn_base.trim_end_matches('/').to_string();

    let tmp = root.join("_efplaytest.zip");
    download_to_file(&app, "download-playtest", &format!("{cdn}/patch/dev.zip"), &tmp).await?;

    emit(&app, "extract-playtest", "Installing the playtest build…".into(), 0.0, 0, 0);
    let (tmp2, paks2) = (tmp.clone(), paks.clone());
    let staged = tauri::async_runtime::spawn_blocking(move || stage_test_pak(&tmp2, &paks2))
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    let _ = fs::remove_file(&tmp);
    emit(
        &app,
        "extract-playtest",
        format!("Playtest build installed ({staged})"),
        100.0,
        0,
        0,
    );

    let variant = game::switch_to(&s.game_path, "playtest")?;
    emit(&app, "done", "Playtest build ready".into(), 100.0, 0, 0);
    Ok(variant)
}
