use crate::error::{AppError, AppResult, ErrorCode};
use crate::{game, settings};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::Emitter;

/// Parallel connections for large downloads (each takes a byte range).
const SEGMENTS: u64 = 6;
/// Don't bother splitting anything smaller than this per connection.
const MIN_SEGMENT: u64 = 32 * 1024 * 1024;

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

fn http() -> AppResult<reqwest::Client> {
    let c = reqwest::Client::builder()
        .user_agent(concat!("ef-launcher/", env!("CARGO_PKG_VERSION")))
        // Timeout after 15s if no connexion established
        .connect_timeout(Duration::from_secs(15))
        // Timeout if no byte received after 1min.
        .read_timeout(Duration::from_secs(60))
        .build()?;
    Ok(c)
}

/// Download `url` to `dest`. Probes for HTTP range support first: servers
/// that honor ranges (the CDN does) get a multi-connection segmented
/// download, everything else falls back to a single stream.
async fn download_to_file(
    app: &tauri::AppHandle,
    stage: &str,
    url: &str,
    dest: &Path,
) -> AppResult<()> {
    let client = http()?;

    let probe = client
        .get(url)
        .header(reqwest::header::RANGE, "bytes=0-0")
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| AppError::detail(ErrorCode::DownloadFailed, e).with("url", url))?;

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
) -> AppResult<()> {
    let mut resp = client
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| AppError::detail(ErrorCode::DownloadFailed, e).with("url", url))?;

    let total = resp.content_length().unwrap_or(0);
    let mut file = File::create(dest)?;
    let mut done: u64 = 0;
    let mut last = Instant::now();
    let mut last_bytes = 0u64;

    while let Some(chunk) = resp.chunk().await? {
        file.write_all(&chunk)?;
        done += chunk.len() as u64;
        let delta_time = last.elapsed();
        if delta_time.as_millis() >= 150 {
            let pct = if total > 0 { done as f64 / total as f64 * 100.0 } else { 0.0 };
            // Speed over the window since the last tick, same readout as the
            // segmented path's reporter.
            let speed = ((done - last_bytes) as f64 / delta_time.as_secs_f64()) as u64;
            emit(
                app,
                stage,
                format!("{} / {}  ({}/s)", human(done), human(total), human(speed)),
                pct,
                done,
                total,
            );
            last = Instant::now();
            last_bytes = done;
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
) -> AppResult<()> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .open(dest)
?;
    file.seek(SeekFrom::Start(start))?;

    let mut pos = start;
    let mut attempts = 0u32;

    while pos <= end {
        let pos_before = pos;
        attempts += 1;
        if attempts > 5 {
            return Err(AppError::new(ErrorCode::DownloadStalled)
                .with("range", format!("{start}-{end}"))
                .with("remaining", human(end + 1 - pos)));
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
                        file.write_all(&chunk)?;
                        pos += chunk.len() as u64;
                        done.fetch_add(chunk.len() as u64, Ordering::Relaxed);
                    }
                    Ok(None) => break,
                    Err(_) => break, // connection dropped — retry from pos
                }
            },
            Ok(_) => return Err(AppError::new(ErrorCode::RangeRequestsUnsupported)),
            Err(_) => {}
        }

        if pos > pos_before {
            attempts = 0; // making progress — keep going
        }
        if pos <= end {
            file.seek(SeekFrom::Start(pos))?;
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
) -> AppResult<()> {
    // Preallocate so every worker can write into its own region.
    File::create(dest)
        .and_then(|f| f.set_len(total).map(|_| ()))
?;

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

    let mut result: AppResult<()> = Ok(());
    for w in workers {
        match w.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => result = result.and(Err(e)),
            Err(e) => {
                result = result.and(Err(AppError::detail(ErrorCode::BackgroundTaskFailed, e)))
            }
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
/// Turn a zip entry name into a safe relative path under the install dir.
/// `enclosed_name()` returns None (and the old code SILENTLY skipped the file)
/// for anything it deems non-enclosed — a Windows-built archive entry, an odd
/// component, a leading slash — which is exactly how a "downloaded but broken"
/// install happens: a handful of assets/paks vanish with no error and the game
/// renders garbage. Here we sanitize instead of dropping: normalise backslashes,
/// clamp `..`, strip drive/empty components. Only a name that sanitises to
/// nothing returns None (a pure directory marker), never a real file.
fn safe_rel_path(name: &str) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for comp in name.replace('\\', "/").split('/') {
        match comp {
            "" | "." => continue,
            ".." => {
                out.pop();
            }
            c => {
                // Drop a bare Windows drive prefix ("C:") if it ever leads a name.
                if c.ends_with(':') && c.len() <= 2 {
                    continue;
                }
                out.push(c);
            }
        }
    }
    (!out.as_os_str().is_empty()).then_some(out)
}

fn extract_all(app: &tauri::AppHandle, stage: &str, zip_path: &Path, dest: &Path) -> AppResult<()> {
    let file = File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let total = zip.len();

    // Total UNCOMPRESSED bytes, read from the central directory (no decompression).
    // Progress is driven by bytes, not file count: the archive ends with one huge
    // game pak, so a per-file bar hits ~99% and then sits frozen for minutes while
    // that last file copies. Byte progress (updated DURING the copy) moves smoothly.
    let mut total_bytes: u64 = 0;
    for i in 0..total {
        total_bytes += zip.by_index(i)?.size();
    }
    let total_bytes = total_bytes.max(1);

    // Count files written vs. files the archive says it holds. A mismatch means
    // something was silently dropped (or the archive is truncated/corrupt); we
    // surface that as an error so the user retries a clean download instead of
    // launching a half-extracted, glitched install.
    let mut expected_files = 0usize;
    let mut written = 0usize;
    let mut bytes_done: u64 = 0;
    let mut buf = vec![0u8; 1 << 20]; // 1 MiB copy buffer
    let mut last = Instant::now();

    for i in 0..total {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        if entry.is_dir() {
            if let Some(rel) = safe_rel_path(&name) {
                fs::create_dir_all(dest.join(rel))?;
            }
            continue;
        }
        expected_files += 1;
        // A real file MUST resolve to a path — never silently skipped.
        let rel = safe_rel_path(&name)
            .ok_or_else(|| AppError::detail(ErrorCode::BadArchiveEntry, format!("{name:?}")))?;
        let out = dest.join(rel);
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut f = File::create(&out)?;
        // Copy in chunks and report progress DURING the file, so a multi-GB pak
        // shows a moving bar instead of looking hung on the final entry.
        loop {
            let n = entry.read(&mut buf)?;
            if n == 0 {
                break;
            }
            f.write_all(&buf[..n])?;
            bytes_done += n as u64;
            if last.elapsed().as_millis() >= 150 {
                emit(
                    app,
                    stage,
                    format!("{name}  ({} / {})", human(bytes_done), human(total_bytes)),
                    bytes_done as f64 / total_bytes as f64 * 100.0,
                    bytes_done,
                    total_bytes,
                );
                last = Instant::now();
            }
        }
        written += 1;
    }

    if written != expected_files {
        return Err(AppError::new(ErrorCode::ExtractionIncomplete)
            .with("written", written)
            .with("expected", expected_files));
    }
    emit(app, stage, format!("{written} files extracted"), 100.0, total_bytes, total_bytes);
    Ok(())
}

/// Extract every file of a zip flat into one directory (used for the balance
/// patch, whose paks belong directly in g3/Content/Paks).
fn extract_flat(zip_path: &Path, dest: &Path) -> AppResult<Vec<String>> {
    let file = File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let mut names = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let Some(rel) = entry.enclosed_name() else { continue };
        let Some(base) = rel.file_name() else { continue };
        let out = dest.join(base);
        let mut f = File::create(&out)?;
        std::io::copy(&mut entry, &mut f)?;
        names.push(base.to_string_lossy().into_owned());
    }
    Ok(names)
}

/// Pull the pak/sig out of the playtest archive under the names the playtest
/// variant looks for, whatever they're called inside it. Returns what it
/// found, for the progress line.
fn stage_test_pak(zip_path: &Path, paks: &Path) -> AppResult<String> {
    let file = File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let mut pak = false;
    let mut sig = false;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let Some(rel) = entry.enclosed_name() else { continue };
        let Some(name) = rel
            .file_name()
            .and_then(|n| n.to_str())
            .map(str::to_ascii_lowercase)
        else {
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
        let mut f = File::create(&dest)?;
        std::io::copy(&mut entry, &mut f)?;
    }
    if !pak {
        return Err(AppError::new(ErrorCode::PlaytestArchiveEmpty));
    }
    Ok(if sig {
        "pak + sig".into()
    } else {
        "pak (unsigned)".into()
    })
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
#[specta::specta]
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
    let local = (!s.game_path.is_empty())
        .then(|| game::read_local_version(Path::new(&s.game_path)))
        .flatten();

    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let remote = match http() {
        Ok(client) => fetch_remote_game_version(&client, &cdn).await,
        Err(_) => None,
    };
    VersionInfo { local, remote }
}

/// Read a NUL-terminated field out of a tar header block.
fn tar_str(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).into_owned()
}

/// Parse a tar octal size field (space/NUL padded).
fn tar_octal(bytes: &[u8]) -> Option<u64> {
    let s = tar_str(bytes);
    let s = s.trim_matches(|c| c == ' ' || c == '\0');
    if s.is_empty() {
        return Some(0);
    }
    u64::from_str_radix(s, 8).ok()
}

/// Pull the single `umu-run` zipapp out of umu-launcher's (uncompressed) tar
/// release and write it to `dest`. The archive holds only `umu/umu-run` (the
/// python zipapp) and a `umu/umu_run.py` symlink to it, so we walk the plain
/// USTAR 512-byte headers and take the one regular file named `umu-run`. Kept
/// dependency-free (the zip crate can't read tar, and pulling in a tar crate
/// for two entries isn't worth it).
fn extract_umu_run(tar_path: &Path, dest: &Path) -> AppResult<()> {
    let data = fs::read(tar_path)?;
    let mut off = 0usize;
    while off + 512 <= data.len() {
        let header = &data[off..off + 512];
        // Two consecutive zero blocks end the archive; one is enough to stop.
        if header.iter().all(|&b| b == 0) {
            break;
        }
        let name = tar_str(&header[0..100]);
        let size = tar_octal(&header[124..136])
            .ok_or_else(|| AppError::new(ErrorCode::RuntimeArchiveCorrupt))?;
        let typeflag = header[156];
        let data_start = off + 512;
        let data_end = data_start
            .checked_add(size as usize)
            .filter(|&e| e <= data.len())
            .ok_or_else(|| AppError::new(ErrorCode::RuntimeArchiveCorrupt))?;

        // Regular file ('0' or legacy NUL typeflag) whose basename is umu-run.
        let is_regular = typeflag == b'0' || typeflag == 0;
        let base = name.rsplit('/').next().unwrap_or(&name);
        if is_regular && base == "umu-run" {
            fs::write(dest, &data[data_start..data_end])?;
            return Ok(());
        }

        // Advance past this entry's data, padded up to the next 512 boundary.
        off = data_start + ((size as usize + 511) & !511);
    }
    Err(AppError::new(ErrorCode::RuntimeMissingUmu))
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tar_reader_pulls_umu_run() {
        // Build a minimal two-entry tar (a dir + the umu-run regular file) and
        // confirm the reader extracts exactly the file's bytes.
        fn header(name: &str, size: u64, typeflag: u8) -> Vec<u8> {
            let mut h = vec![0u8; 512];
            let nb = name.as_bytes();
            h[..nb.len()].copy_from_slice(nb);
            let octal = format!("{size:011o}\0");
            h[124..124 + octal.len()].copy_from_slice(octal.as_bytes());
            h[156] = typeflag;
            h
        }
        let payload = b"#!/usr/bin/env python3\nPK-zipapp-bytes";
        let mut tar = Vec::new();
        tar.extend(header("umu/", 0, b'5'));
        tar.extend(header("umu/umu-run", payload.len() as u64, b'0'));
        tar.extend(payload);
        tar.extend(vec![0u8; 512 - payload.len() % 512]); // pad to 512
        tar.extend(vec![0u8; 1024]); // end-of-archive

        let tmp = tempfile::tempdir().unwrap();
        let tar_path = tmp.path().join("umu.tar");
        let out = tmp.path().join("umu-run");
        fs::write(&tar_path, &tar).unwrap();
        extract_umu_run(&tar_path, &out).unwrap();
        assert_eq!(fs::read(&out).unwrap(), payload);
    }

    #[test]
    fn tar_reader_errors_when_absent() {
        let tmp = tempfile::tempdir().unwrap();
        let tar_path = tmp.path().join("empty.tar");
        fs::write(&tar_path, vec![0u8; 1024]).unwrap();
        assert!(extract_umu_run(&tar_path, &tmp.path().join("umu-run")).is_err());
    }

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

    /// The dev opt-in is a switch, not a "the variable exists" test — an
    /// EF_LAUNCHER_UPDATE=0 left behind in a shell profile means off.
    #[test]
    fn launcher_update_opt_in_reads_as_a_switch() {
        assert!(opt_in(Some("1")));
        assert!(opt_in(Some("yes")));
        assert!(!opt_in(Some("0")));
        assert!(!opt_in(Some("")));
        assert!(!opt_in(None));
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
