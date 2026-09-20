use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

// The loader is the one DLL that goes into the game's Win64 binary folder (the
// game imports it at startup); every OTHER *.dll in mod.zip goes into Mods/dlls.
// Nothing is hardcoded beyond this rule, so a new mod ships just by being in the zip.
pub const LOADER_DLL: &str = "xinput1_3.dll";

#[derive(Serialize, specta::Type)]
pub struct FileCheck {
    pub label: String,
    pub path: String,
    pub present: bool,
}

fn win64_dir(root: &Path) -> PathBuf {
    root.join("g3").join("Binaries").join("Win64")
}

#[tauri::command]
#[specta::specta]
pub fn verify_install(app: tauri::AppHandle) -> Vec<FileCheck> {
    let s = settings::load(&app);
    let root = PathBuf::from(&s.game_path);
    let mut out = Vec::new();
    {
        let mut check = |label: &str, p: PathBuf| {
            out.push(FileCheck {
                label: label.into(),
                present: p.exists(),
                path: p.to_string_lossy().into_owned(),
            })
        };
        check("Mod loader", win64_dir(&root).join(LOADER_DLL));
        // List whatever mod DLLs are actually installed — no fixed roster, so this
        // stays correct as mods are added/removed from mod.zip.
        let dlls_dir = root.join("Mods").join("dlls");
        let mut names: Vec<String> = fs::read_dir(&dlls_dir)
            .into_iter()
            .flatten()
            .flatten()
            .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("dll")))
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort_unstable();
        for name in names {
            check(&name, dlls_dir.join(&name));
        }
    }
    // Auth is no longer verified here — it lives in the launcher and is handed
    // to the game in memory at launch, never written into the game folder.
    out
}

/// The CDN path of the production mod package, and its key in the signed manifest.
pub const MOD_ZIP: &str = "patch/mod/mod.zip";

/// The Playtest channel's package. A complete mod set of its own — its own
/// loader, its own DLLs, its own paks — rather than a patch on top of the
/// production one, so a beta can ship whatever roster it likes (a 7.0.0-b1
/// appserver, a Chapter 2 crouch_mod) and production never loads a byte of it.
pub const MOD_ZIP_PLAYTEST: &str = "patch/mod/mod-dev.zip";

/// Channel ids, as recorded in the game folder.
pub const CHANNEL_EF: &str = "ef";
pub const CHANNEL_PLAYTEST: &str = "playtest";

/// Which package a variant runs. Production and Vanilla share the Elemental
/// Fracture mods — Vanilla parks the balance pak, it doesn't change the mods —
/// and the Playtest channel has its own.
pub fn channel_for_variant(variant: &str) -> &'static str {
    if variant == CHANNEL_PLAYTEST {
        CHANNEL_PLAYTEST
    } else {
        CHANNEL_EF
    }
}

/// The CDN path (and manifest key) of a channel's package.
pub fn zip_key(channel: &str) -> &'static str {
    if channel == CHANNEL_PLAYTEST {
        MOD_ZIP_PLAYTEST
    } else {
        MOD_ZIP
    }
}

/// What the last install put on disk, so a channel switch can take it back off
/// again. Kept beside the mods rather than in settings: the game folder then
/// describes its own mod state, and clearing the launcher's settings can't
/// strand playtest DLLs in a production install.
const MODSET_FILE: &str = "Mods/.ef_modset.json";

/// Verified packages are kept here, so flipping between channels doesn't
/// re-download ~100 MB each way (and works with the network down).
const CACHE_DIR: &str = "Mods/.ef_modcache";

#[derive(Serialize, Deserialize, Default)]
struct ModSet {
    /// CHANNEL_EF | CHANNEL_PLAYTEST
    channel: String,
    /// SHA-256 of the package these files came out of.
    sha256: String,
    /// Root-relative, '/'-separated paths of everything the package placed.
    files: Vec<String>,
}

fn read_modset(root: &Path) -> ModSet {
    fs::read(root.join(MODSET_FILE))
        .ok()
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

fn cache_path(root: &Path, channel: &str) -> PathBuf {
    root.join(CACHE_DIR).join(format!("{channel}.zip"))
}

/// A placed file as the record names it: root-relative, forward slashes, so a
/// record written on Windows reads the same on Linux.
fn rel_path(root: &Path, dest: &Path) -> String {
    dest.strip_prefix(root)
        .unwrap_or(dest)
        .to_string_lossy()
        .replace('\\', "/")
}

/// The places a mod package is allowed to own. The record is ours, but it is a
/// file on a player's disk that drives deletions — so a channel switch only
/// ever removes something from the three directories `install_from_zip` writes.
fn is_mod_path(rel: &str) -> bool {
    !rel.contains("..")
        && (rel.starts_with("Mods/dlls/")
            || rel.starts_with("g3/Content/Paks/")
            || rel.eq_ignore_ascii_case(&format!("g3/Binaries/Win64/{LOADER_DLL}")))
}

/// True when this channel's files are all in place, so switching onto it needs
/// neither the network nor an extraction — the usual case for a tester
/// flipping back to a channel this machine has already run.
pub fn channel_installed(root: &Path, channel: &str) -> bool {
    let set = read_modset(root);
    set.channel == channel && !set.files.is_empty() && set.files.iter().all(|f| root.join(f).exists())
}

fn http() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        // Timeout after 15s if no connexion established
        .connect_timeout(std::time::Duration::from_secs(15))
        // Timeout if no byte received after 1min.
        .read_timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))
}

/// Pull a channel's package off the CDN and hand back its bytes, which have
/// hashed to `sha256` — nothing else ever reaches the game folder.
async fn download_package(cdn_base: &str, channel: &str, sha256: &str) -> AppResult<Vec<u8>> {
    let key = zip_key(channel);
    let url = format!("{}/{key}", cdn_base.trim_end_matches('/'));
    let resp = http()?
        .get(&url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))?;
    if bytes.len() < 1024 {
        return Err(AppError::new(ErrorCode::ModArchiveTooSmall));
    }
    let actual = crate::download::manifest::sha256_hex(&bytes);
    if actual != sha256 {
        return Err(AppError::new(ErrorCode::DownloadHashMismatch)
            .with("file", key.rsplit('/').next().unwrap_or(key))
            .with("expected", sha256)
            .with("actual", actual));
    }
    Ok(bytes.to_vec())
}

/// Install a channel's mod package into the game folder. Port of install.bat:
/// purge old Mods/dlls/*.dll, drop the loader into g3/Binaries/Win64, copy the
/// mod DLLs — plus, now that there is more than one package, take off whatever
/// the previously installed channel left behind. Shared by the Mods-view
/// button, the install/update pipeline (patch → mods → version bump) and the
/// channel switch.
///
/// `sha256` is the manifest's entry for the package; nothing is written into
/// the game folder unless the bytes hash to it. A package that did hash is kept
/// under `Mods/.ef_modcache`, so switching back to this channel later costs
/// nothing.
pub async fn fetch_and_install(cdn_base: &str, root: PathBuf, sha256: &str, channel: &str) -> AppResult<Vec<String>> {
    if !win64_dir(&root).is_dir() {
        return Err(AppError::new(ErrorCode::NotSpellbreakInstall));
    }

    let want = sha256.to_ascii_lowercase();
    let cached = cache_path(&root, channel);
    let mut from_cache = false;
    let bytes = match fs::read(&cached) {
        // A package we already verified is as good as one off the wire.
        Ok(b) if crate::download::manifest::sha256_hex(&b) == want => {
            from_cache = true;
            b
        }
        _ => {
            let bytes = download_package(cdn_base, channel, &want).await?;
            // Best effort: a cache we couldn't write only means the next switch
            // downloads again.
            if let Some(dir) = cached.parent() {
                if fs::create_dir_all(dir).is_ok() {
                    let _ = fs::write(&cached, &bytes);
                }
            }
            bytes
        }
    };

    let channel = channel.to_string();
    let mut log = tauri::async_runtime::spawn_blocking(move || install_from_zip(&root, &bytes, &channel, &want))
        .await
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))??;
    if from_cache {
        log.insert(0, "Reused the cached package (already verified)".into());
    }
    Ok(log)
}

#[tauri::command]
#[specta::specta]
pub async fn install_mods(app: tauri::AppHandle) -> AppResult<Vec<String>> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let root = PathBuf::from(&s.game_path);
    // Reinstall what the build on disk runs, not always production: pressing
    // "Install / Update mods" on the playtest channel must not drop production
    // DLLs onto a playtest install.
    let channel = channel_for_variant(&crate::game::detect_variant(&root));
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let manifest = crate::download::manifest::fetch_manifest(&app, &http()?, &cdn).await?;
    fetch_and_install(&cdn, root, manifest.hash_for(zip_key(channel))?, channel).await
}

/// Put the mod set for `variant` in place. Called *before* the variant's pak
/// swap, so a failed download leaves the build the player is on fully intact.
/// A no-op (no network at all) when the channel is already installed.
pub async fn sync_channel(app: &tauri::AppHandle, variant: &str) -> AppResult<Vec<String>> {
    let s = settings::load(app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let root = PathBuf::from(&s.game_path);
    let channel = channel_for_variant(variant);
    if channel_installed(&root, channel) {
        return Ok(Vec::new());
    }
    let name = if channel == CHANNEL_PLAYTEST { "playtest" } else { "production" };
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    crate::download::progress::emit(app, "install-mods", format!("Fetching the {name} mods…"), 0.0, 0, 0);
    let manifest = crate::download::manifest::fetch_manifest(app, &http()?, &cdn).await?;
    let log = fetch_and_install(&cdn, root, manifest.hash_for(zip_key(channel))?, channel).await?;
    let installed = log.iter().filter(|l| l.starts_with("Installed")).count();
    crate::download::progress::emit(
        app,
        "install-mods",
        format!("{name} mods installed ({installed} files)"),
        100.0,
        0,
        0,
    );
    Ok(log)
}

fn install_from_zip(root: &Path, bytes: &[u8], channel: &str, sha256: &str) -> AppResult<Vec<String>> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes))?;
    let mut log = Vec::new();

    let dlls_dir = root.join("Mods").join("dlls");
    let cmds_dir = root.join("Mods").join("commands");
    fs::create_dir_all(&dlls_dir)?;
    fs::create_dir_all(&cmds_dir)?;

    // Paks bundled in a mod package (e.g. EFCrouch_P.pak + its .sig) install
    // into g3/Content/Paks. The version swapper (game/variant.rs) only ever
    // parks/activates ElefracBalance/ElefracTest, so these are never touched by
    // a Classic/EF/Playtest switch — but a pak that only one channel ships is
    // removed below when the other channel takes over.
    let paks = crate::game::paks_dir(root);
    fs::create_dir_all(&paks)?;

    // Decide every placement first, so the previous channel's leftovers can be
    // told apart from files this package is about to overwrite: the loader →
    // g3/Binaries/Win64, all other DLLs → Mods/dlls, paks and sigs →
    // g3/Content/Paks. Everything is then written in one go and read back
    // against the package like the game files are (download/archive.rs).
    let win64 = win64_dir(root);
    let mut placements = Vec::new();
    let mut installed = Vec::new();
    let mut files = Vec::new();
    let mut count = 0usize;
    let mut pak_count = 0usize;
    let mut loader_ok = false;
    for i in 0..zip.len() {
        let name = zip.by_index(i)?.name().to_string();
        let base = name.rsplit(['/', '\\']).next().unwrap_or(&name).to_string();
        let lower = base.to_ascii_lowercase();
        let is_dll = lower.ends_with(".dll");
        let is_pak = lower.ends_with(".pak") || lower.ends_with(".sig");
        if !is_dll && !is_pak {
            continue; // skip dirs / other payload
        }
        let is_loader = is_dll && base.eq_ignore_ascii_case(LOADER_DLL);
        let dest = if is_loader {
            win64.join(&base)
        } else if is_dll {
            dlls_dir.join(&base)
        } else {
            paks.join(&base) // mod pak/sig → g3/Content/Paks
        };
        files.push(rel_path(root, &dest));
        placements.push((i, dest));
        if is_dll {
            installed.push(format!("Installed {base}{}", if is_loader { " (loader → Win64)" } else { "" }));
            count += 1;
            loader_ok |= is_loader;
        } else {
            installed.push(format!("Installed {base} (pak → Content/Paks)"));
            pak_count += 1;
        }
    }

    // Take the previous channel's files back off: anything it placed that this
    // package doesn't replace. Without this, switching from Playtest back to
    // Production would leave a playtest-only pak mounted (the DLL purge below
    // only covers Mods/dlls), which is exactly the cross-contamination the
    // separate channels exist to prevent.
    let prev = read_modset(root);
    if prev.channel != channel {
        for rel in prev.files.iter().filter(|r| is_mod_path(r) && !files.contains(r)) {
            if fs::remove_file(root.join(rel)).is_ok() {
                log.push(format!("Removed {rel} (not in the {channel} package)"));
            }
        }
    }

    // Purge stale mod DLLs so removed mods from older versions can't linger.
    // Only *.dll inside Mods/dlls — configs and logs are left alone.
    if let Ok(rd) = fs::read_dir(&dlls_dir) {
        for entry in rd.flatten() {
            let p = entry.path();
            if p.extension().is_some_and(|x| x.eq_ignore_ascii_case("dll")) {
                let _ = fs::remove_file(&p);
            }
        }
        log.push("Removed old Mods/dlls/*.dll".into());
    }

    // Auth moved into the launcher (passed via environment at launch) —
    // scrub the old plaintext files.
    for legacy in ["auth_token.txt", "ef_server.txt"] {
        if fs::remove_file(cmds_dir.join(legacy)).is_ok() {
            log.push(format!("Removed legacy Mods/commands/{legacy}"));
        }
    }
    // Same for the `.ef_auth` marker that succeeded them: the game reads the
    // session key from its environment now, so a copy in the game folder is
    // only a plaintext credential sitting on a possibly-shared drive.
    if fs::remove_file(root.join(".ef_auth")).is_ok() {
        log.push("Removed legacy .ef_auth".into());
    }

    crate::download::extract_entries(&mut zip, placements)?;
    log.extend(installed);
    if !loader_ok {
        log.push(format!("WARNING: {LOADER_DLL} (loader) not found in package"));
    }
    log.push(format!("{count} DLL(s) installed"));
    if pak_count > 0 {
        log.push(format!("{pak_count} pak file(s) installed"));
    }

    // Record what landed, and which channel it came from. Written last: until
    // the files are on disk there is nothing to take off again.
    let set = ModSet { channel: channel.into(), sha256: sha256.into(), files };
    if let Ok(json) = serde_json::to_vec_pretty(&set) {
        let _ = fs::write(root.join(MODSET_FILE), json);
    }
    log.push(format!("Mod channel: {channel}"));

    // ef_server.txt from the package is deliberately NOT installed anymore —
    // the launcher provides the server via the environment.

    Ok(log)
}

#[cfg(test)]
#[path = "__tests/mods.rs"]
mod tests;
