use crate::{game, settings};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::Emitter;

/// Parallel connections for large downloads (each takes a byte range).
const SEGMENTS: u64 = 6;
/// Don't bother splitting anything smaller than this per connection.
const MIN_SEGMENT: u64 = 32 * 1024 * 1024;

#[derive(Serialize, Clone)]
struct Progress {
    stage: String,
    message: String,
    percent: f64,
    done: u64,
    total: u64,
}

fn emit(app: &tauri::AppHandle, stage: &str, message: String, percent: f64, done: u64, total: u64) {
    let _ = app.emit(
        "install-progress",
        Progress { stage: stage.into(), message, percent, done, total },
    );
}

fn human(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut v = bytes as f64;
    let mut u = 0;
    while v >= 1024.0 && u < UNITS.len() - 1 {
        v /= 1024.0;
        u += 1;
    }
    format!("{v:.1} {}", UNITS[u])
}

fn http() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!("ef-launcher/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

/// Download `url` to `dest`. Probes for HTTP range support first: servers
/// that honor ranges (the CDN does) get a multi-connection segmented
/// download, everything else falls back to a single stream.
async fn download_to_file(
    app: &tauri::AppHandle,
    stage: &str,
    url: &str,
    dest: &Path,
) -> Result<(), String> {
    let client = http()?;

    let probe = client
        .get(url)
        .header(reqwest::header::RANGE, "bytes=0-0")
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("download failed ({url}): {e}"))?;

    let ranged_total = if probe.status() == reqwest::StatusCode::PARTIAL_CONTENT {
        probe
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.rsplit('/').next())
            .and_then(|s| s.trim().parse::<u64>().ok())
    } else {
        None
    };
    drop(probe);

    match ranged_total {
        Some(total) if total >= MIN_SEGMENT * 2 => {
            download_segmented(app, stage, &client, url, dest, total).await
        }
        _ => download_sequential(app, stage, &client, url, dest).await,
    }
}

async fn download_sequential(
    app: &tauri::AppHandle,
    stage: &str,
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
) -> Result<(), String> {
    let mut resp = client
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("download failed ({url}): {e}"))?;

    let total = resp.content_length().unwrap_or(0);
    let mut file = File::create(dest).map_err(|e| format!("{}: {e}", dest.display()))?;
    let mut done: u64 = 0;
    let mut last = Instant::now();

    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        done += chunk.len() as u64;
        if last.elapsed().as_millis() >= 150 {
            let pct = if total > 0 { done as f64 / total as f64 * 100.0 } else { 0.0 };
            emit(app, stage, format!("{} / {}", human(done), human(total)), pct, done, total);
            last = Instant::now();
        }
    }
    emit(app, stage, format!("{} downloaded", human(done)), 100.0, done, total.max(done));
    Ok(())
}

/// One worker: fetch bytes [start..=end] into its slice of the file.
/// Writes are strictly sequential within the region, so a plain seek-once
/// file handle works on every OS. Retries resume from wherever the stream
/// died; the retry budget resets whenever progress is being made.
async fn download_range(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    start: u64,
    end: u64,
    done: &AtomicU64,
) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .open(dest)
        .map_err(|e| format!("{}: {e}", dest.display()))?;
    file.seek(SeekFrom::Start(start)).map_err(|e| e.to_string())?;

    let mut pos = start;
    let mut attempts = 0u32;

    while pos <= end {
        let pos_before = pos;
        attempts += 1;
        if attempts > 5 {
            return Err(format!("download stalled (range {start}-{end}, {} left)", human(end + 1 - pos)));
        }

        let resp = client
            .get(url)
            .header(reqwest::header::RANGE, format!("bytes={pos}-{end}"))
            .send()
            .await
            .and_then(|r| r.error_for_status());

        match resp {
            Ok(mut r) if r.status() == reqwest::StatusCode::PARTIAL_CONTENT => loop {
                match r.chunk().await {
                    Ok(Some(chunk)) => {
                        file.write_all(&chunk).map_err(|e| e.to_string())?;
                        pos += chunk.len() as u64;
                        done.fetch_add(chunk.len() as u64, Ordering::Relaxed);
                    }
                    Ok(None) => break,
                    Err(_) => break, // connection dropped — retry from pos
                }
            },
            Ok(_) => return Err("server stopped honoring range requests".into()),
            Err(_) => {}
        }

        if pos > pos_before {
            attempts = 0; // making progress — keep going
        }
        if pos <= end {
            file.seek(SeekFrom::Start(pos)).map_err(|e| e.to_string())?;
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }
    Ok(())
}

async fn download_segmented(
    app: &tauri::AppHandle,
    stage: &str,
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    total: u64,
) -> Result<(), String> {
    // Preallocate so every worker can write into its own region.
    File::create(dest)
        .and_then(|f| f.set_len(total).map(|_| ()))
        .map_err(|e| format!("{}: {e}", dest.display()))?;

    let segments = SEGMENTS.min(total / MIN_SEGMENT).max(2);
    let done = Arc::new(AtomicU64::new(0));
    let finished = Arc::new(AtomicBool::new(false));

    // Progress reporter with a live speed readout.
    let reporter = {
        let (app, stage, done, finished) =
            (app.clone(), stage.to_string(), done.clone(), finished.clone());
        tokio::spawn(async move {
            let mut last_bytes = 0u64;
            let mut last_t = Instant::now();
            loop {
                tokio::time::sleep(Duration::from_millis(300)).await;
                let d = done.load(Ordering::Relaxed);
                let dt = last_t.elapsed().as_secs_f64();
                let speed = if dt > 0.0 { ((d - last_bytes) as f64 / dt) as u64 } else { 0 };
                last_bytes = d;
                last_t = Instant::now();
                emit(
                    &app,
                    &stage,
                    format!("{} / {}  ({}/s)", human(d), human(total), human(speed)),
                    d as f64 / total as f64 * 100.0,
                    d,
                    total,
                );
                if finished.load(Ordering::Relaxed) {
                    break;
                }
            }
        })
    };

    let chunk = total / segments;
    let mut workers = Vec::new();
    for i in 0..segments {
        let start = i * chunk;
        let end = if i == segments - 1 { total - 1 } else { (i + 1) * chunk - 1 };
        let (client, url, dest, done) =
            (client.clone(), url.to_string(), dest.to_path_buf(), done.clone());
        workers.push(tokio::spawn(async move {
            download_range(&client, &url, &dest, start, end, &done).await
        }));
    }

    let mut result: Result<(), String> = Ok(());
    for w in workers {
        match w.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => result = result.and(Err(e)),
            Err(e) => result = result.and(Err(e.to_string())),
        }
    }
    finished.store(true, Ordering::Relaxed);
    let _ = reporter.await;

    if result.is_ok() {
        emit(app, stage, format!("{} downloaded", human(total)), 100.0, total, total);
    }
    result
}

/// Extract a zip preserving its directory structure.
fn extract_all(app: &tauri::AppHandle, stage: &str, zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("bad zip: {e}"))?;
    let total = zip.len();
    let mut last = Instant::now();

    for i in 0..total {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel) = entry.enclosed_name() else { continue };
        let out = dest.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut f = File::create(&out).map_err(|e| format!("{}: {e}", out.display()))?;
        std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;

        if last.elapsed().as_millis() >= 150 {
            emit(
                app,
                stage,
                format!("{} ({i}/{total})", entry.name()),
                i as f64 / total as f64 * 100.0,
                i as u64,
                total as u64,
            );
            last = Instant::now();
        }
    }
    emit(app, stage, format!("{total} files extracted"), 100.0, total as u64, total as u64);
    Ok(())
}

/// Extract every file of a zip flat into one directory (used for the balance
/// patch, whose paks belong directly in g3/Content/Paks).
fn extract_flat(zip_path: &Path, dest: &Path) -> Result<Vec<String>, String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("bad zip: {e}"))?;
    let mut names = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let Some(rel) = entry.enclosed_name() else { continue };
        let Some(base) = rel.file_name() else { continue };
        let out = dest.join(base);
        let mut f = File::create(&out).map_err(|e| format!("{}: {e}", out.display()))?;
        std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
        names.push(base.to_string_lossy().into_owned());
    }
    Ok(names)
}

/// All remote launcher configuration lives in one ini file on the CDN:
/// {cdn}/launcher/config.ini. It carries both version tracks
/// (GameVersion / LauncherVersion) and has room for any future settings.
/// Parsed leniently: `key=value` lines, `[sections]` skipped, `;`/`#`
/// comments, UTF-8 or the old UTF-16LE+BOM. Keys are matched
/// case-insensitively.
pub fn parse_ini(text: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') || line.starts_with('[') {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            map.insert(k.trim().to_ascii_lowercase(), v.trim().to_string());
        }
    }
    map
}

async fn fetch_remote_config(
    client: &reqwest::Client,
    cdn: &str,
) -> std::collections::HashMap<String, String> {
    let resp = client
        .get(format!("{cdn}/launcher/config.ini"))
        .timeout(Duration::from_secs(8))
        .send()
        .await;
    let Ok(resp) = resp else { return Default::default() };
    if !resp.status().is_success() {
        return Default::default();
    }
    let Ok(bytes) = resp.bytes().await else { return Default::default() };
    parse_ini(&game::decode_version_bytes(&bytes))
}

/// Version values must look like versions, not S3 error pages served as 200.
fn valid_version(v: &str) -> bool {
    !v.is_empty() && v.len() <= 32 && !v.contains('<')
}

fn config_version(cfg: &std::collections::HashMap<String, String>, key: &str) -> Option<String> {
    cfg.get(key).filter(|v| valid_version(v)).cloned()
}

async fn fetch_remote_game_version(client: &reqwest::Client, cdn: &str) -> Option<String> {
    config_version(&fetch_remote_config(client, cdn).await, "gameversion")
}

async fn fetch_remote_launcher_version(client: &reqwest::Client, cdn: &str) -> Option<String> {
    config_version(&fetch_remote_config(client, cdn).await, "launcherversion")
}

/// The whole remote config, for anything the frontend wants from it.
#[tauri::command]
pub async fn get_remote_config(app: tauri::AppHandle) -> std::collections::HashMap<String, String> {
    let s = settings::load(&app);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    match http() {
        Ok(client) => fetch_remote_config(&client, &cdn).await,
        Err(_) => Default::default(),
    }
}

/// Bring an install in agreement with the CDN: fetch the latest version,
/// pull the balance patch into g3/Content/Paks, install the mod package,
/// and only once BOTH have landed bump the local version.txt to match —
/// a half-provisioned install keeps looking outdated and gets retried.
/// Shared by fresh installs, manual updates, newly-pointed-at game folders,
/// and the automatic startup update check.
async fn apply_patch(app: &tauri::AppHandle, cdn: &str, root: &Path) -> Result<String, String> {
    let paks = game::paks_dir(root);
    if !paks.is_dir() {
        return Err(format!("Paks folder not found: {}", paks.display()));
    }

    let remote_version = fetch_remote_game_version(&http()?, cdn).await;

    let tmp = root.join("_efpatch.zip");
    download_to_file(app, "download-patch", &format!("{cdn}/patch/latest.zip"), &tmp).await?;

    emit(app, "extract-patch", "Installing patch…".into(), 0.0, 0, 0);
    let (tmp2, paks2) = (tmp.clone(), paks.clone());
    let names = tauri::async_runtime::spawn_blocking(move || extract_flat(&tmp2, &paks2))
        .await
        .map_err(|e| e.to_string())??;
    let _ = fs::remove_file(&tmp);
    emit(app, "extract-patch", format!("Patch installed ({} files)", names.len()), 100.0, 0, 0);

    emit(app, "install-mods", "Downloading mod package…".into(), 0.0, 0, 0);
    let mod_log = crate::mods::fetch_and_install(cdn, root.to_path_buf()).await?;
    let installed = mod_log.iter().filter(|l| l.starts_with("Installed")).count();
    emit(app, "install-mods", format!("Mods installed ({installed} files)"), 100.0, 0, 0);

    // The install now matches the CDN — bump version.txt to say so.
    match remote_version {
        Some(v) => {
            fs::write(root.join("version.txt"), &v)
                .map_err(|e| format!("patch applied, but couldn't write version.txt: {e}"))?;
            Ok(v)
        }
        None => Ok("unknown".into()),
    }
}

/// Fresh install: base game zip → dest, then patch + version bump.
#[tauri::command]
pub async fn download_game(app: tauri::AppHandle, dest: String) -> Result<String, String> {
    let s = settings::load(&app);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let dest = PathBuf::from(dest);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let tmp_zip = dest.join("_elefracbase.zip.part");
    emit(&app, "download-base", "Starting download…".into(), 0.0, 0, 0);
    download_to_file(&app, "download-base", &format!("{cdn}/game/elefracbase.zip"), &tmp_zip).await?;

    let (app2, dest2, zip2) = (app.clone(), dest.clone(), tmp_zip.clone());
    tauri::async_runtime::spawn_blocking(move || extract_all(&app2, "extract-base", &zip2, &dest2))
        .await
        .map_err(|e| e.to_string())??;
    let _ = fs::remove_file(&tmp_zip);

    // The zip may either contain g3/Engine at its root or a single wrapper dir.
    let root = if dest.join("g3").is_dir() {
        dest.clone()
    } else {
        fs::read_dir(&dest)
            .map_err(|e| e.to_string())?
            .flatten()
            .map(|e| e.path())
            .find(|p| p.join("g3").is_dir())
            .ok_or("Extracted files don't contain a g3 folder: unexpected archive layout.")?
    };

    apply_patch(&app, &cdn, &root).await?;

    let s = settings::mutate(&app, |s| {
        s.game_path = root.to_string_lossy().into_owned();
    })?;

    emit(&app, "done", "Installation complete".into(), 100.0, 0, 0);
    Ok(s.game_path)
}

/// Re-apply the latest balance patch to an existing install.
#[tauri::command]
pub async fn update_patch(app: tauri::AppHandle) -> Result<String, String> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err("Set the game folder first (Settings).".into());
    }
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let version = apply_patch(&app, &cdn, Path::new(&s.game_path)).await?;
    emit(&app, "done", "Update complete".into(), 100.0, 0, 0);
    Ok(version)
}

/// Pull the balance pak (and its .sig) out of dev.zip and place them as
/// ElefracTest_P.pak / ElefracTest_P.sig, whatever they were named inside the
/// archive, so the Test Build can sit parked beside the production pak.
fn stage_test_pak(zip_path: &Path, paks: &Path) -> Result<String, String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("bad zip: {e}"))?;
    let mut pak = false;
    let mut sig = false;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let Some(rel) = entry.enclosed_name() else { continue };
        let Some(name) = rel.file_name().and_then(|n| n.to_str()).map(str::to_ascii_lowercase) else {
            continue;
        };
        let dest = if name.ends_with(".pak") {
            pak = true;
            paks.join("ElefracTest_P.pak")
        } else if name.ends_with(".sig") {
            sig = true;
            paks.join("ElefracTest_P.sig")
        } else {
            continue;
        };
        let mut f = File::create(&dest).map_err(|e| format!("{}: {e}", dest.display()))?;
        std::io::copy(&mut entry, &mut f).map_err(|e| e.to_string())?;
    }
    if !pak {
        return Err("dev.zip didn't contain a .pak file.".into());
    }
    Ok(if sig { "pak + sig".into() } else { "pak (unsigned)".into() })
}

/// Download the Public Test Build balance pak ({cdn}/patch/dev.zip), stage it
/// as ElefracTest_P.pak beside the production pak, then switch the game onto it
/// (which parks the Elemental Fracture pak). Gated in the UI behind the Tester
/// badge; the CDN path is unlisted rather than access-controlled.
#[tauri::command]
pub async fn install_dev_build(app: tauri::AppHandle) -> Result<String, String> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err("Set the game folder first (Settings).".into());
    }
    let root = PathBuf::from(&s.game_path);
    let paks = game::paks_dir(&root);
    if !paks.is_dir() {
        return Err(format!("Paks folder not found: {}", paks.display()));
    }
    let cdn = s.cdn_base.trim_end_matches('/').to_string();

    let tmp = root.join("_efdev.zip");
    download_to_file(&app, "download-dev", &format!("{cdn}/patch/dev.zip"), &tmp).await?;

    emit(&app, "extract-dev", "Installing Test Build…".into(), 0.0, 0, 0);
    let (tmp2, paks2) = (tmp.clone(), paks.clone());
    let staged = tauri::async_runtime::spawn_blocking(move || stage_test_pak(&tmp2, &paks2))
        .await
        .map_err(|e| e.to_string())??;
    let _ = fs::remove_file(&tmp);
    emit(&app, "extract-dev", format!("Test Build installed ({staged})"), 100.0, 0, 0);

    let variant = game::switch_to(&s.game_path, "dev")?;
    emit(&app, "done", "Test Build ready".into(), 100.0, 0, 0);
    Ok(variant)
}

/// Installed vs latest version, for the update badge.
#[tauri::command]
pub async fn get_versions(app: tauri::AppHandle) -> serde_json::Value {
    let s = settings::load(&app);
    let local = (!s.game_path.is_empty())
        .then(|| game::read_local_version(Path::new(&s.game_path)))
        .flatten();

    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let remote = match http() {
        Ok(client) => fetch_remote_game_version(&client, &cdn).await,
        Err(_) => None,
    };
    serde_json::json!({ "local": local, "remote": remote })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ini_versions_and_extras() {
        let cfg = parse_ini(
            "; Elemental Fracture launcher configuration\n\
             [Versions]\n\
             LauncherVersion = 1.0.0\n\
             GameVersion=6.0.2\n\
             # future settings ride along\n\
             DiscordUrl = https://dsc.gg/elefrac\n",
        );
        assert_eq!(config_version(&cfg, "launcherversion").as_deref(), Some("1.0.0"));
        assert_eq!(config_version(&cfg, "gameversion").as_deref(), Some("6.0.2"));
        assert_eq!(cfg.get("discordurl").unwrap(), "https://dsc.gg/elefrac");
    }

    #[test]
    fn ini_rejects_error_pages() {
        let cfg = parse_ini("<?xml version=\"1.0\"?><Error><Code>NoSuchKey</Code></Error>");
        assert_eq!(config_version(&cfg, "gameversion"), None);
        assert_eq!(config_version(&cfg, "launcherversion"), None);
    }
}

/// The version marker written after a successful self-update. Guards
/// against a re-prompt loop when the downloaded binary still reports an
/// older compiled-in version.
fn launcher_version_marker(app: &tauri::AppHandle) -> PathBuf {
    settings::config_dir(app).join("launcher_version.txt")
}

/// Compare this launcher against {cdn}/launcher/version.txt. Also cleans up
/// the .old binary a previous self-update left behind.
/// What a self-update actually replaces, and the CDN file it pulls.
/// A plain binary swaps itself; an AppImage's mount is read-only, so we
/// swap the .AppImage file it was launched from ($APPIMAGE, set by the
/// AppImage runtime).
fn update_target() -> Result<(PathBuf, &'static str), String> {
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
        return Ok((PathBuf::from(appimage), "ef-launcher.AppImage"));
    }
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    Ok((exe, if cfg!(windows) { "ef-launcher.exe" } else { "ef-launcher" }))
}

#[tauri::command]
pub async fn get_launcher_update(app: tauri::AppHandle) -> serde_json::Value {
    if let Ok((target, _)) = update_target() {
        let _ = fs::remove_file(target.with_extension("old"));
    }

    let s = settings::load(&app);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let current = env!("CARGO_PKG_VERSION").to_string();
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
    serde_json::json!({ "current": current, "remote": remote, "update": update })
}

/// Self-update: pull the new binary from the CDN, swap it in place of the
/// running one (rename the live exe aside first, Windows allows that but
/// not overwriting), bump the local version marker, restart.
#[tauri::command]
pub async fn update_launcher(app: tauri::AppHandle) -> Result<(), String> {
    let s = settings::load(&app);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let remote = fetch_remote_launcher_version(&http()?, &cdn)
        .await
        .ok_or("Couldn't read the launcher version from the CDN.")?;

    let (exe, binary) = update_target()?;
    let staged = exe.with_extension("new");
    download_to_file(&app, "download-launcher", &format!("{cdn}/launcher/{binary}"), &staged).await?;

    let size = fs::metadata(&staged).map(|m| m.len()).unwrap_or(0);
    if size < 1024 * 1024 {
        let _ = fs::remove_file(&staged);
        return Err("Downloaded launcher is suspiciously small: the CDN may have returned an error page.".into());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&staged, fs::Permissions::from_mode(0o755));
    }

    let parked = exe.with_extension("old");
    let _ = fs::remove_file(&parked);
    fs::rename(&exe, &parked).map_err(|e| format!("couldn't stage the running binary: {e}"))?;
    if let Err(e) = fs::rename(&staged, &exe) {
        let _ = fs::rename(&parked, &exe); // roll back so the install stays runnable
        return Err(format!("couldn't install the new binary: {e}"));
    }

    let _ = fs::write(launcher_version_marker(&app), &remote);

    std::process::Command::new(&exe)
        .spawn()
        .map_err(|e| format!("updated, but couldn't restart the launcher: {e}"))?;
    app.exit(0);
    Ok(())
}
