//! Getting a file off the CDN, in as many pieces as the server allows, and
//! picking up where a failed attempt left off.
//!
//! Every download has two files on disk while it runs: the payload itself and
//! a small `<payload>.state` beside it recording what the payload is (URL,
//! size, ETag, the hash it must end up with) and how far each connection got.
//! A download that dies (network drop, closed laptop, killed launcher) leaves
//! both behind; the next attempt reads the state, confirms the server still
//! has the same object, and resumes each segment from its recorded position
//! instead of starting the 10 GB base game from byte zero.
//!
//! Resuming is only safe because nothing is trusted until the finished file
//! hashes to what the signed manifest says. A stale segment, a changed object
//! the ETag check missed, a disk that lied: all of them end in a hash mismatch,
//! and a mismatch throws the file away. The same check is what lets a download
//! that already finished (extraction failed, say) be reused without another
//! fetch.

use super::manifest::hex;
use super::progress::{emit, human};
use crate::error::{AppError, AppResult, ErrorCode};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Parallel connections for large downloads (each takes a byte range).
const SEGMENTS: u64 = 6;
/// Don't bother splitting anything smaller than this per connection.
const MIN_SEGMENT: u64 = 32 * 1024 * 1024;
/// How often the segment positions are flushed to the state file while a
/// download runs. A crash loses at most this much progress per connection.
const STATE_FLUSH: Duration = Duration::from_secs(2);

pub(super) fn http() -> AppResult<reqwest::Client> {
    let c = reqwest::Client::builder()
        .user_agent(concat!("ef-launcher/", env!("CARGO_PKG_VERSION")))
        // Timeout after 15s if no connexion established
        .connect_timeout(Duration::from_secs(15))
        // Timeout if no byte received after 1min.
        .read_timeout(Duration::from_secs(60))
        .build()?;
    Ok(c)
}

/// One connection's slice of the file and how far into it the bytes have
/// landed. `pos` is the next byte to fetch; `pos == end + 1` is finished.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(super) struct Segment {
    pub start: u64,
    pub end: u64,
    pub pos: u64,
}

/// The sidecar a download keeps beside its payload.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub(super) struct State {
    pub url: String,
    pub total: u64,
    /// The server's ETag at the time the download began, or "" if it sent
    /// none. A different one on resume means a different object.
    pub etag: String,
    /// What the manifest said the finished file hashes to.
    pub sha256: String,
    pub segments: Vec<Segment>,
    /// Every byte landed and the hash checked out. A complete payload is
    /// reused as-is (after re-hashing) rather than fetched again.
    pub complete: bool,
}

pub(super) fn state_path(dest: &Path) -> PathBuf {
    let mut s = dest.as_os_str().to_owned();
    s.push(".state");
    PathBuf::from(s)
}

impl State {
    pub fn load(dest: &Path) -> Option<State> {
        let raw = fs::read_to_string(state_path(dest)).ok()?;
        serde_json::from_str(&raw).ok()
    }

    /// Written whole-file-then-rename so a crash mid-write leaves the previous
    /// state, not half a JSON document.
    pub fn save(&self, dest: &Path) {
        let path = state_path(dest);
        let tmp = path.with_extension("state.tmp");
        if let Ok(json) = serde_json::to_string(self) {
            if fs::write(&tmp, json).is_ok() {
                let _ = fs::rename(&tmp, &path);
            }
        }
    }

    /// Bytes landed so far, across every segment.
    pub fn done(&self) -> u64 {
        self.segments.iter().map(|s| s.pos - s.start).sum()
    }

    /// Whether the download this state describes can continue against what the
    /// server is offering now and what the manifest wants.
    pub fn resumes(&self, url: &str, total: u64, etag: &str, sha256: &str, on_disk: u64) -> bool {
        !self.complete
            && self.url == url
            && self.total == total
            && self.etag == etag
            && self.sha256 == sha256
            && on_disk == total
            && !self.segments.is_empty()
            && self.segments.iter().all(|s| s.start <= s.pos && s.pos <= s.end + 1)
    }
}

/// How a file of `total` bytes is split across connections. Deterministic in
/// `total`, and recorded in the state file anyway so a resume never has to
/// re-derive it.
pub(super) fn layout(total: u64) -> Vec<Segment> {
    let segments = SEGMENTS.min(total / MIN_SEGMENT).max(1);
    let chunk = total / segments;
    (0..segments)
        .map(|i| {
            let start = i * chunk;
            let end = if i == segments - 1 { total - 1 } else { (i + 1) * chunk - 1 };
            Segment { start, end, pos: start }
        })
        .collect()
}

/// Remove a payload and its state file. What a mismatch or a fresh start
/// does, and what callers do once the payload has served its purpose.
pub(super) fn discard(dest: &Path) {
    let _ = fs::remove_file(dest);
    let _ = fs::remove_file(state_path(dest));
}

/// Download `url` to `dest` and confirm it hashes to `sha256`.
///
/// Probes for HTTP range support first: servers that honor ranges (the CDN
/// does) get a multi-connection segmented download that can resume; anything
/// else gets a single stream from the top. Either way the finished file is
/// hashed before this returns Ok, and a file that does not match is deleted.
pub(super) async fn download_to_file(
    app: &tauri::AppHandle,
    stage: &str,
    url: &str,
    dest: &Path,
    sha256: &str,
) -> AppResult<()> {
    let sha256 = sha256.to_ascii_lowercase();
    let prior = State::load(dest);
    let on_disk = fs::metadata(dest).map(|m| m.len()).unwrap_or(0);

    // A finished payload from an earlier run (its extraction failed, or the
    // launcher was closed between download and install): keep it if it still
    // hashes right, which is the same bar a fresh download has to clear.
    if let Some(st) = &prior {
        if st.complete && st.url == url && st.sha256 == sha256 && on_disk == st.total {
            emit(app, stage, "Checking the earlier download…".into(), 0.0, 0, st.total);
            if verify_hash(app, stage, dest, &sha256).await.is_ok() {
                emit(app, stage, format!("{} already downloaded", human(st.total)), 100.0, st.total, st.total);
                return Ok(());
            }
            discard(dest);
        }
    }

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
    let etag = probe
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    drop(probe);

    match ranged_total {
        Some(total) if total > 0 => {
            let resumed = prior
                .filter(|st| st.resumes(url, total, &etag, &sha256, on_disk))
                .unwrap_or_else(|| {
                    discard(dest);
                    State {
                        url: url.to_string(),
                        total,
                        etag: etag.clone(),
                        sha256: sha256.clone(),
                        segments: layout(total),
                        complete: false,
                    }
                });
            download_segmented(app, stage, &client, dest, resumed).await?;
        }
        _ => {
            discard(dest);
            download_sequential(app, stage, &client, url, dest).await?;
        }
    }

    match verify_hash(app, stage, dest, &sha256).await {
        Ok(()) => {
            if let Some(mut st) = State::load(dest) {
                st.complete = true;
                st.save(dest);
            }
            Ok(())
        }
        Err(e) => {
            discard(dest);
            Err(e)
        }
    }
}

/// Stream `path` through SHA-256 and compare. Reports through `stage` so a
/// 10 GB check is a moving bar, not a hang after the download says 100%.
async fn verify_hash(app: &tauri::AppHandle, stage: &str, path: &Path, expected: &str) -> AppResult<()> {
    let (app2, stage2, path2) = (app.clone(), stage.to_string(), path.to_path_buf());
    let actual = tauri::async_runtime::spawn_blocking(move || -> AppResult<String> {
        let mut file = File::open(&path2)?;
        let total = file.metadata()?.len();
        let mut hasher = Sha256::new();
        let mut buf = vec![0u8; 1 << 20];
        let mut done = 0u64;
        let mut last = Instant::now();
        loop {
            let n = file.read(&mut buf)?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
            done += n as u64;
            if last.elapsed().as_millis() >= 150 {
                let pct = if total > 0 { done as f64 / total as f64 * 100.0 } else { 100.0 };
                emit(&app2, &stage2, format!("Verifying…  {} / {}", human(done), human(total)), pct, done, total);
                last = Instant::now();
            }
        }
        Ok(hex(&hasher.finalize()))
    })
    .await
    .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;

    if actual != expected {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.display().to_string());
        return Err(AppError::new(ErrorCode::DownloadHashMismatch)
            .with("file", name.trim_start_matches('_').trim_end_matches(".part"))
            .with("expected", expected)
            .with("actual", actual));
    }
    Ok(())
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

/// One worker: fetch bytes [pos..=end] into its slice of the file, starting
/// from wherever `pos` already stands (byte `start` on a fresh download, further
/// in on a resume). Writes are strictly sequential within the region, so a
/// plain seek-once file handle works on every OS. Retries resume from wherever
/// the stream died; the retry budget resets whenever progress is being made.
async fn download_range(
    client: &reqwest::Client,
    url: &str,
    dest: &Path,
    start: u64,
    end: u64,
    pos: &AtomicU64,
) -> AppResult<()> {
    let mut file = fs::OpenOptions::new().write(true).open(dest)?;
    let mut at = pos.load(Ordering::Relaxed);
    file.seek(SeekFrom::Start(at))?;

    let mut attempts = 0u32;

    while at <= end {
        let at_before = at;
        attempts += 1;
        if attempts > 5 {
            return Err(AppError::new(ErrorCode::DownloadStalled)
                .with("range", format!("{start}-{end}"))
                .with("remaining", human(end + 1 - at)));
        }

        let resp = client
            .get(url)
            .header(reqwest::header::RANGE, format!("bytes={at}-{end}"))
            .send()
            .await
            .and_then(|r| r.error_for_status());

        match resp {
            Ok(mut r) if r.status() == reqwest::StatusCode::PARTIAL_CONTENT => loop {
                match r.chunk().await {
                    Ok(Some(chunk)) => {
                        file.write_all(&chunk)?;
                        at += chunk.len() as u64;
                        pos.store(at, Ordering::Relaxed);
                    }
                    Ok(None) => break,
                    Err(_) => break, // connection dropped: retry from `at`
                }
            },
            Ok(_) => return Err(AppError::new(ErrorCode::RangeRequestsUnsupported)),
            Err(_) => {}
        }

        if at > at_before {
            attempts = 0; // making progress: keep going
        }
        if at <= end {
            file.seek(SeekFrom::Start(at))?;
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }
    Ok(())
}

async fn download_segmented(
    app: &tauri::AppHandle,
    stage: &str,
    client: &reqwest::Client,
    dest: &Path,
    state: State,
) -> AppResult<()> {
    let total = state.total;
    let already = state.done();
    if already == 0 {
        // Preallocate so every worker can write into its own region.
        File::create(dest).and_then(|f| f.set_len(total).map(|_| ()))?;
    } else {
        emit(app, stage, format!("Resuming at {} / {}", human(already), human(total)), already as f64 / total as f64 * 100.0, already, total);
    }
    state.save(dest);

    let positions: Arc<Vec<AtomicU64>> =
        Arc::new(state.segments.iter().map(|s| AtomicU64::new(s.pos)).collect());
    let finished = Arc::new(AtomicBool::new(false));

    /// The state as it stands right now, from the live positions.
    fn snapshot(state: &State, positions: &[AtomicU64]) -> State {
        let mut st = state.clone();
        for (seg, pos) in st.segments.iter_mut().zip(positions) {
            seg.pos = pos.load(Ordering::Relaxed);
        }
        st
    }

    // Progress reporter with a live speed readout; also the one that flushes
    // the segment positions to disk so a crash can resume.
    let reporter = {
        let (app, stage, state, positions, finished, dest) = (
            app.clone(),
            stage.to_string(),
            state.clone(),
            positions.clone(),
            finished.clone(),
            dest.to_path_buf(),
        );
        tokio::spawn(async move {
            let mut last_bytes = already;
            let mut last_t = Instant::now();
            let mut last_flush = Instant::now();
            loop {
                tokio::time::sleep(Duration::from_millis(300)).await;
                let st = snapshot(&state, &positions);
                let d = st.done();
                let dt = last_t.elapsed().as_secs_f64();
                let speed = if dt > 0.0 { ((d.saturating_sub(last_bytes)) as f64 / dt) as u64 } else { 0 };
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
                if last_flush.elapsed() >= STATE_FLUSH {
                    st.save(&dest);
                    last_flush = Instant::now();
                }
                if finished.load(Ordering::Relaxed) {
                    break;
                }
            }
        })
    };

    let mut workers = Vec::new();
    for (i, seg) in state.segments.iter().enumerate() {
        if seg.pos > seg.end {
            continue; // this slice landed in an earlier run
        }
        let (client, url, dest, positions) =
            (client.clone(), state.url.clone(), dest.to_path_buf(), positions.clone());
        let (start, end) = (seg.start, seg.end);
        workers.push(tokio::spawn(async move {
            download_range(&client, &url, &dest, start, end, &positions[i]).await
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
    // Whatever happened, record where every segment stands: that is what the
    // next attempt resumes from.
    snapshot(&state, &positions).save(dest);

    if result.is_ok() {
        emit(app, stage, format!("{} downloaded", human(total)), 100.0, total, total);
    }
    result
}

#[cfg(test)]
#[path = "__tests/transfer.rs"]
mod tests;
