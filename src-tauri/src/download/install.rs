//! Putting the game on disk and keeping it level with the CDN: the fresh
//! install, the balance patch, the playtest channel, and the version readout
//! the update badge hangs off.

use super::archive::{bytes_to_unpack, ensure_room, extract_all, extract_flat, read_tail, stage_test_pak, Tail};
use super::config::fetch_remote_versions_for_variant;
use super::manifest::{fetch_manifest, Manifest};
use super::progress::emit;
use super::runtime::ensure_runtime;
use super::transfer::{discard, download_to_file, fetch_range, http, still_to_land};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{game, settings};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// CDN paths of the game payloads, which double as their manifest keys.
const BASE_ZIP: &str = "game/elefracbase.zip";
const PATCH_ZIP: &str = "patch/latest.zip";
const PLAYTEST_ZIP: &str = "patch/dev.zip";

/// Bring an install in agreement with the CDN: fetch the latest version,
/// pull the balance patch into g3/Content/Paks, install the mod package,
/// and only once BOTH have landed bump the local version.txt to match —
/// a half-provisioned install keeps looking outdated and gets retried.
/// Shared by fresh installs, manual updates, newly-pointed-at game folders,
/// and the automatic startup update check.
///
/// `manifest` is the signed list the caller already fetched for this run;
/// both payloads here are checked against it before anything is extracted.
async fn apply_patch(app: &tauri::AppHandle, cdn: &str, root: &Path, manifest: &Manifest) -> AppResult<String> {
    let paks = game::paks_dir(root);
    if !paks.is_dir() {
        return Err(AppError::new(ErrorCode::PaksNotFound).with("path", paks.display()));
    }

    // Which build this install is on decides what an update means: the Playtest
    // channel gets the playtest pak and the playtest mods, Production and
    // Vanilla the Elemental Fracture ones.
    let variant = game::detect_variant(root);
    let channel = crate::mods::channel_for_variant(&variant);

    let (remote_game_version, remote_mod_version) = match http() {
        Ok(client) => fetch_remote_versions_for_variant(&client, cdn, &variant).await,
        Err(_) => (None, None),
    };

    let tmp = root.join("_efpatch.zip");
    download_to_file(
        app,
        "download-patch",
        &format!("{cdn}/{PATCH_ZIP}"),
        &tmp,
        manifest.hash_for(PATCH_ZIP)?,
    )
    .await?;

    emit(app, "extract-patch", "Installing patch…".into(), 0.0, 0, 0);
    let (tmp2, paks2) = (tmp.clone(), paks.clone());
    let names = tauri::async_runtime::spawn_blocking(move || extract_flat(&tmp2, &paks2))
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    discard(&tmp);
    if !game::balance_pak_present(root) {
        return Err(AppError::new(ErrorCode::PatchPakMissing)
            .with("paks", paks.display())
            .with("delivered", names.join(", ")));
    }
    emit(app, "extract-patch", format!("Patch installed ({} files)", names.len()), 100.0, 0, 0);

    // The balance pak is in and verified, so the game track is current: record it here rather than at the
    // end, so a failure later in this run leaves the MOD track stale (and the badge lit) instead of both.
    // game_version.txt is the same value under the name the client mod prefers.
    if let Some(ref gv) = remote_game_version {
        fs::write(root.join("version.txt"), gv)
            .map_err(|e| AppError::detail(ErrorCode::PatchVersionWriteFailed, e))?;
        let _ = fs::write(root.join("game_version.txt"), gv);
    }

    // On the Playtest channel this update is the playtest build's update too,
    // so its pak comes down in the same run.
    if variant == "playtest" {
        stage_playtest_pak(app, cdn, root, &paks, manifest).await?;
    }
    // The patch just dropped an *active* ElefracBalance_P.pak into Content/Paks.
    // On any build that doesn't mount it, that would leave two balance paks
    // loaded at once, so re-apply the layout the player is actually on.
    if variant == "playtest" || variant == "classic" {
        game::switch_to(&root.to_string_lossy(), &variant)?;
    }

    emit(app, "install-mods", "Downloading mod package…".into(), 0.0, 0, 0);
    let mod_log = crate::mods::fetch_and_install(
        cdn,
        root.to_path_buf(),
        manifest.hash_for(crate::mods::zip_key(channel))?,
        channel,
    )
    .await?;
    let installed = mod_log.iter().filter(|l| l.starts_with("Installed")).count();
    emit(app, "install-mods", format!("Mods installed ({installed} files)"), 100.0, 0, 0);

    // The mod package is in, so the mod track is current. ef_version.txt carries the same value for DLLs
    // from before the split, which read that file as their only version: they report a 3.x there, the
    // appserver reads it as a mod version, and it asks them for the update they are in fact missing.
    if let Some(ref mv) = remote_mod_version {
        let dlls = root.join("Mods").join("dlls");
        let _ = fs::create_dir_all(&dlls);
        fs::write(dlls.join("mod_version.txt"), mv)
            .map_err(|e| AppError::detail(ErrorCode::PatchVersionWriteFailed, e))?;
        let _ = fs::write(dlls.join("ef_version.txt"), mv);
    }

    match (remote_game_version, remote_mod_version) {
        (Some(gv), Some(mv)) => Ok(format!("{gv} (m{mv})")),
        (Some(gv), None) => Ok(gv),
        (None, Some(mv)) => Ok(format!("m{mv}")),
        (None, None) => Ok("unknown".into()),
    }
}

/// The base archive's size and file listing, read from its last bytes before
/// any of the rest is fetched. None if the server or the archive doesn't
/// cooperate: the check this feeds is advisory, and the exact one runs again
/// before unpacking.
async fn remote_listing(client: &reqwest::Client, url: &str) -> Option<(u64, Vec<(String, u64)>)> {
    // The base archive's central directory is ~160 KB; 1 MiB covers several
    // thousand entries. Past 64 MiB it isn't worth fetching just to check.
    const TAIL: u64 = 1 << 20;
    const MAX_DIRECTORY: u64 = 64 << 20;
    let (size, start, bytes) = fetch_range(client, url, &format!("bytes=-{TAIL}")).await?;
    match read_tail(&bytes, start)? {
        Tail::Listing(listing) => Some((size, listing)),
        Tail::NeedFrom(offset) if size.saturating_sub(offset) <= MAX_DIRECTORY => {
            let (_, start, bytes) = fetch_range(client, url, &format!("bytes={offset}-")).await?;
            match read_tail(&bytes, start)? {
                Tail::Listing(listing) => Some((size, listing)),
                Tail::NeedFrom(_) => None,
            }
        }
        Tail::NeedFrom(_) => None,
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

    let manifest = fetch_manifest(&app, &http()?, &cdn).await?;

    // The .part file and its .state sidecar survive a failed run on purpose:
    // the next attempt resumes them (see transfer.rs). They go only once the
    // archive has been extracted and verified.
    let tmp_zip = dest.join("_elefracbase.zip.part");
    let base_url = format!("{cdn}/{BASE_ZIP}");

    // Fail now rather than after the download: the archive and everything it
    // unpacks to must fit side by side, since the archive is only deleted once
    // the unpacked files have been verified against it.
    emit(&app, "download-base", "Checking free space…".into(), 0.0, 0, 0);
    if let Some((size, listing)) = remote_listing(&http()?, &base_url).await {
        let need = still_to_land(&tmp_zip, &base_url, size) + bytes_to_unpack(&listing, &dest);
        ensure_room(&dest, need)?;
    }

    emit(&app, "download-base", "Starting download…".into(), 0.0, 0, 0);
    download_to_file(
        &app,
        "download-base",
        &base_url,
        &tmp_zip,
        manifest.hash_for(BASE_ZIP)?,
    )
    .await?;

    // Until every file has been read back and matched, the folder is not an
    // install: the marker keeps `find_exe` (and with it "Locate game") from
    // taking a half-unpacked folder for a finished one if this run dies.
    let marker = dest.join(game::UNPACKING_MARKER);
    fs::write(&marker, b"")?;
    let (app2, dest2, zip2) = (app.clone(), dest.clone(), tmp_zip.clone());
    tauri::async_runtime::spawn_blocking(move || {
        extract_all(&app2, "extract-base", "verify-base", &zip2, &dest2)
    })
    .await
    .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    fs::remove_file(&marker)?;
    discard(&tmp_zip);

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

    apply_patch(&app, &cdn, &root, &manifest).await?;

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
    let manifest = fetch_manifest(&app, &http()?, &cdn).await?;
    let version = apply_patch(&app, &cdn, Path::new(&s.game_path), &manifest).await?;
    emit(&app, "done", "Update complete".into(), 100.0, 0, 0);
    Ok(version)
}

#[derive(Serialize, specta::Type)]
pub struct VersionInfo {
    pub local: Option<String>,
    pub remote: Option<String>,
    pub local_game: Option<String>,
    pub remote_game: Option<String>,
    pub local_mod: Option<String>,
    pub remote_mod: Option<String>,
}

/// Installed vs latest version, for the update badge.
#[tauri::command]
#[specta::specta]
pub async fn get_versions(app: tauri::AppHandle) -> VersionInfo {
    let s = settings::load(&app);
    let root = Path::new(&s.game_path);
    let variant = game::detect_variant(root);
    // An install missing its balance pak is out of date no matter what
    // version.txt says, so reporting no local version lights the update badge.
    // For playtest installs, check if either the production pak or test pak is present.
    let pak_present = game::balance_pak_present(root) || (variant == "playtest" && game::test_build_installed(root));
    let local_game = (!s.game_path.is_empty() && pak_present)
        .then(|| game::read_local_version(root))
        .flatten();
    let local_mod = (!s.game_path.is_empty())
        .then(|| game::read_local_mod_version(root))
        .flatten();

    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let (remote_game, remote_mod) = match http() {
        Ok(client) => fetch_remote_versions_for_variant(&client, &cdn, &variant).await,
        Err(_) => (None, None),
    };

    let local = match (&local_game, &local_mod) {
        (Some(gv), Some(mv)) => Some(format!("{gv} (m{mv})")),
        (Some(gv), _) => Some(gv.clone()),
        (None, Some(mv)) => Some(format!("m{mv}")),
        (None, _) => None,
    };
    let remote = match (&remote_game, &remote_mod) {
        (Some(gv), Some(mv)) => Some(format!("{gv} (m{mv})")),
        (Some(gv), None) => Some(gv.clone()),
        (None, Some(mv)) => Some(format!("m{mv}")),
        (None, None) => None,
    };

    VersionInfo {
        local,
        remote,
        local_game,
        remote_game,
        local_mod,
        remote_mod,
    }
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
    // Enabling Playtest is also how a tester gets today's build: the paks are
    // re-checked against the CDN every time, not just the first time. Nothing is
    // downloaded when the staged build is already the one being served.
    match fetch_manifest(&app, &http()?, &cdn).await {
        Ok(manifest) => stage_playtest_pak(&app, &cdn, &root, &paks, &manifest).await?,
        // Offline with the build already on disk: switch onto what's here rather
        // than refuse. An install that has never had it still needs the network.
        Err(e) if game::test_build_installed(&root) => {
            emit(&app, "extract-playtest", "Offline — keeping the playtest build already installed".into(), 100.0, 0, 0);
            eprintln!("playtest: could not check the CDN for a newer build ({e}); using the one on disk");
        }
        Err(e) => return Err(e),
    }
    // The playtest channel's own mods (its loader, its DLLs, its paks) —
    // nothing of production's is left behind, and nothing of its is left behind
    // when the player switches back.
    crate::mods::sync_channel(&app, "playtest").await?;

    let variant = game::switch_to(&s.game_path, "playtest")?;
    emit(&app, "done", "Playtest build ready".into(), 100.0, 0, 0);
    Ok(variant)
}

/// Which `patch/dev.zip` the staged playtest pak came out of. Kept beside the
/// paks, like the mod channel's record, so the game folder can say for itself
/// whether the build on disk is the one the CDN is serving.
const PLAYTEST_RECORD: &str = "Mods/.ef_playtest.json";

/// The SHA-256 recorded for the staged playtest pak, if there is one.
fn staged_playtest_sha(root: &Path) -> Option<String> {
    let raw = fs::read_to_string(root.join(PLAYTEST_RECORD)).ok()?;
    let doc: serde_json::Value = serde_json::from_str(&raw).ok()?;
    Some(doc.get("sha256")?.as_str()?.to_ascii_lowercase())
}

/// Pull `patch/dev.zip` and stage what it holds as the playtest balance pak,
/// unless the pak already on disk came out of exactly this one. Shared by
/// "enable the playtest build" and by an update run on a machine already on it.
async fn stage_playtest_pak(
    app: &tauri::AppHandle,
    cdn: &str,
    root: &Path,
    paks: &Path,
    manifest: &Manifest,
) -> AppResult<()> {
    let want = manifest.hash_for(PLAYTEST_ZIP)?.to_ascii_lowercase();
    // Already the current build: staging it again would re-extract the same
    // bytes over the pak the game has open.
    if staged_playtest_sha(root).as_deref() == Some(want.as_str()) && game::test_build_installed(root) {
        emit(app, "extract-playtest", "Playtest build is up to date".into(), 100.0, 0, 0);
        return Ok(());
    }

    let tmp = root.join("_efplaytest.zip");
    download_to_file(
        app,
        "download-playtest",
        &format!("{cdn}/{PLAYTEST_ZIP}"),
        &tmp,
        &want,
    )
    .await?;

    emit(app, "extract-playtest", "Installing the playtest build…".into(), 0.0, 0, 0);
    let (tmp2, paks2) = (tmp.clone(), paks.to_path_buf());
    let staged = tauri::async_runtime::spawn_blocking(move || stage_test_pak(&tmp2, &paks2))
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
    discard(&tmp);
    // Record what is now on disk, so the next enable can tell at a glance
    // whether it is still the build the CDN is serving.
    let _ = fs::write(
        root.join(PLAYTEST_RECORD),
        format!("{{\"sha256\":\"{want}\"}}"),
    );
    emit(
        app,
        "extract-playtest",
        format!("Playtest build installed ({staged})"),
        100.0,
        0,
        0,
    );
    Ok(())
}
