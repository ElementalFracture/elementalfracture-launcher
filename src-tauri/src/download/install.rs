//! Putting the game on disk and keeping it level with the CDN: the fresh
//! install, the balance patch, the playtest channel, and the version readout
//! the update badge hangs off.

use super::archive::{bytes_to_unpack, ensure_room, extract_all, extract_flat, read_tail, stage_test_pak, Tail};
use super::config::fetch_remote_versions_for_variant;
use super::manifest::{fetch_manifest, Manifest};
use super::progress::emit;
use super::runtime::ensure_runtime;
use super::transfer::{assemble_parts, discard, download_to_file, fetch_range, http, still_to_land};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{game, settings};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// CDN paths of the game payloads, which double as their manifest keys.
pub(super) const BASE_ZIP: &str = "game/elefracbase.zip";
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
        write_game_version(root, gv)?;
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
        write_mod_version(root, mv)?;
    }
    // Remember what this channel is on, so switching back to it offline restores these same values
    // instead of leaving the other channel's.
    remember_versions(root, &variant, remote_game_version.as_deref(), remote_mod_version.as_deref());

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
pub(super) async fn remote_listing(
    client: &reqwest::Client,
    url: &str,
) -> Option<(u64, Vec<super::archive::ZipEntry>)> {
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

/// True when a parts download failed because the object is not on this CDN at all (HTTP 404), as
/// opposed to a transfer that broke. `status` is set by `transfer::download_to_file` on the probe.
pub(super) fn parts_missing(e: &AppError) -> bool {
    e.code == ErrorCode::DownloadFailed && e.params.get("status").map(String::as_str) == Some("404")
}

/// Where the base archive lives on the CDN.
pub(super) fn base_zip_url(cdn: &str) -> String {
    format!("{cdn}/{BASE_ZIP}")
}

/// `apply_patch` for the verify/repair pass, which has already fetched and
/// checked the manifest for this run. Separate only because `apply_patch`
/// itself is private to this module.
pub(super) async fn apply_patch_for_repair(
    app: &tauri::AppHandle,
    cdn: &str,
    root: &Path,
    manifest: &Manifest,
) -> AppResult<String> {
    apply_patch(app, cdn, root, manifest).await
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
    let base_url = base_zip_url(&cdn);

    // Fail now rather than after the download: the archive and everything it
    // unpacks to must fit side by side, since the archive is only deleted once
    // the unpacked files have been verified against it.
    emit(&app, "download-base", "Checking free space…".into(), 0.0, 0, 0);
    if let Some((size, listing)) = remote_listing(&http()?, &base_url).await {
        let need = still_to_land(&tmp_zip, &base_url, size) + bytes_to_unpack(&listing, &dest);
        ensure_room(&dest, need)?;
    }

    emit(&app, "download-base", "Starting download…".into(), 0.0, 0, 0);
    // The archive is too big for Cloudflare to cache, so the manifest also
    // lists it in parts that are: fetch those and reassemble when it does.
    // The whole-object download below then finds a finished payload, hashes
    // it, and only re-fetches the single object if the assembly is wrong.
    if let Some(parts) = manifest.parts_for(BASE_ZIP) {
        if let Err(e) = assemble_parts(&app, "download-base", &cdn, parts, &tmp_zip, &base_url, manifest.hash_for(BASE_ZIP)?).await {
            // Only a CDN that does not HAVE the parts (404: a mirror or failover standby without them) falls
            // back to the whole archive. A part that merely failed to transfer is retried on the next
            // attempt from where it stopped; falling back there would turn every congested evening into
            // 11 GB uncacheable downloads from the origin, which is exactly what the parts exist to prevent.
            if !parts_missing(&e) {
                return Err(e);
            }
            emit(&app, "download-base", "This CDN has no parts; fetching the whole archive instead".into(), 0.0, 0, 0);
            discard(&tmp_zip);
        }
    }
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

// ── Which version a channel is on ─────────────────────────────────────────────
//
// version.txt (with game_version.txt beside it) and Mods/dlls/mod_version.txt are what the client mod
// reports: the menu shows them, and the appserver gates on them. They belong to the CHANNEL, not to
// the install. Production is on the live GameVersion; the Playtest channel is on whatever label that
// round carries -- "7.0.0-lev-rc", "7.0.0-b1", "7.0.0-tempest-buff" -- published as PlaytestGameVersion
// and PlaytestModVersion in config.ini. A tag is part of the label: the client shows the whole string
// and sends only its numeric head to the gate, so a label may say anything after the numbers.
//
// Switching channels therefore has to rewrite these files. Without that, a tester who enables Playtest
// keeps reporting the production version they patched to, which is what they see in the menu and what
// the appserver reads.
//
// The record below is what this launcher last wrote for each channel, so a switch made offline (or one
// where config.ini never named the playtest labels) still lands on the right values rather than
// leaving the other channel's behind.
const VERSION_RECORD: &str = "Mods/.ef_versions.json";

/// The balance pak's version, under both names the client mod looks for.
fn write_game_version(root: &Path, v: &str) -> AppResult<()> {
    fs::write(root.join("version.txt"), v)
        .map_err(|e| AppError::detail(ErrorCode::PatchVersionWriteFailed, e))?;
    let _ = fs::write(root.join("game_version.txt"), v);
    Ok(())
}

/// The mod package's version. ef_version.txt carries the same value for DLLs from before the version
/// split, which read that file as their only version.
fn write_mod_version(root: &Path, v: &str) -> AppResult<()> {
    let dlls = root.join("Mods").join("dlls");
    let _ = fs::create_dir_all(&dlls);
    fs::write(dlls.join("mod_version.txt"), v)
        .map_err(|e| AppError::detail(ErrorCode::PatchVersionWriteFailed, e))?;
    let _ = fs::write(dlls.join("ef_version.txt"), v);
    Ok(())
}

/// Note what a channel is on. Only values we actually have are recorded, so a run that could not read
/// one track leaves the previous answer for it in place.
fn remember_versions(root: &Path, variant: &str, game: Option<&str>, mods: Option<&str>) {
    if game.is_none() && mods.is_none() {
        return;
    }
    let channel = crate::mods::channel_for_variant(variant);
    let path = root.join(VERSION_RECORD);
    let mut doc: serde_json::Value = fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    if !doc.is_object() {
        doc = serde_json::json!({});
    }
    let entry = doc[channel].as_object().cloned().unwrap_or_default();
    let mut entry = serde_json::Value::Object(entry);
    if let Some(g) = game {
        entry["game"] = serde_json::Value::String(g.to_string());
    }
    if let Some(m) = mods {
        entry["mod"] = serde_json::Value::String(m.to_string());
    }
    doc[channel] = entry;
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let _ = fs::write(&path, doc.to_string());
}

/// What this launcher last wrote for a channel, if it ever did.
fn remembered_versions(root: &Path, variant: &str) -> (Option<String>, Option<String>) {
    let channel = crate::mods::channel_for_variant(variant);
    let read = || -> Option<serde_json::Value> {
        serde_json::from_str(&fs::read_to_string(root.join(VERSION_RECORD)).ok()?).ok()
    };
    let Some(doc) = read() else { return (None, None) };
    let entry = &doc[channel];
    let field = |k: &str| entry[k].as_str().map(str::to_string);
    (field("game"), field("mod"))
}

/// Put the version files in agreement with the channel the install is now on, and report what they
/// say. Called on every channel switch; the files are the only place the client mod looks.
pub(crate) async fn sync_channel_versions(
    app: &tauri::AppHandle,
    root: &Path,
    variant: &str,
) -> (Option<String>, Option<String>) {
    let cdn = settings::load(app).cdn_base.trim_end_matches('/').to_string();
    let (mut game, mut mods) = match http() {
        Ok(client) => fetch_remote_versions_for_variant(&client, &cdn, variant).await,
        Err(_) => (None, None),
    };
    // Offline, or a config.ini that names no label for this channel: whatever was written for it last.
    let (was_game, was_mod) = remembered_versions(root, variant);
    game = game.or(was_game);
    mods = mods.or(was_mod);

    if let Some(ref g) = game {
        if let Err(e) = write_game_version(root, g) {
            eprintln!("versions: could not write the game version for {variant}: {e:?}");
        }
    }
    if let Some(ref m) = mods {
        if let Err(e) = write_mod_version(root, m) {
            eprintln!("versions: could not write the mod version for {variant}: {e:?}");
        }
    }
    remember_versions(root, variant, game.as_deref(), mods.as_deref());
    (game, mods)
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
    // The playtest round has its own labels; report those, not the production versions this install
    // was patched to. Without this the menu (and the appserver) still read 6.4.2 on a 7.0.0 build.
    let (game_ver, mod_ver) = sync_channel_versions(&app, &root, &variant).await;
    emit(
        &app,
        "done",
        match (&game_ver, &mod_ver) {
            (Some(g), Some(m)) => format!("Playtest build ready ({g}, m{m})"),
            (Some(g), None) => format!("Playtest build ready ({g})"),
            _ => "Playtest build ready".into(),
        },
        100.0,
        0,
        0,
    );
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

#[cfg(test)]
#[path = "__tests/install.rs"]
mod tests;
