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

use super::manifest::{hex, Parts};
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

/// Where one download sits inside a bigger job, for the progress bar. The
/// base archive arrives as dozens of parts; reporting each part from 0 to
/// 100% would make the bar jump back every few hundred MB, so a part reports
/// `offset + done` of the job's `total` instead. `total == 0` means "this
/// file is the whole job".
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Span {
    pub offset: u64,
    pub total: u64,
}

impl Span {
    pub const WHOLE: Span = Span { offset: 0, total: 0 };

    /// `(done, total)` as the bar should show them.
    pub fn place(&self, done: u64, file_total: u64) -> (u64, u64) {
        if self.total > 0 {
            (self.offset + done, self.total)
        } else {
            (done, file_total)
        }
    }

    fn report(&self, app: &tauri::AppHandle, stage: &str, done: u64, file_total: u64, suffix: &str) {
        let (d, t) = self.place(done, file_total);
        let pct = if t > 0 { d as f64 / t as f64 * 100.0 } else { 0.0 };
        emit(app, stage, format!("{} / {}{suffix}", human(d), human(t)), pct, d, t);
    }
}

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

/// How much of the payload at `dest` still has to arrive: none of a finished
/// download of this object, the missing segments of an interrupted one, all
/// of anything else.
pub(super) fn still_to_land(dest: &Path, url: &str, total: u64) -> u64 {
    match State::load(dest) {
        Some(st) if st.url == url && st.total == total => {
            if st.complete {
                0
            } else {
                total.saturating_sub(st.done())
            }
        }
        _ => total,
    }
}

/// One byte range of `url`: `(object size, offset the bytes start at, bytes)`.
/// None unless the server answers with exactly that — a 206 and a
/// Content-Range to place it by.
pub(super) async fn fetch_range(client: &reqwest::Client, url: &str, range: &str) -> Option<(u64, u64, Vec<u8>)> {
    let r = client
        .get(url)
        .header(reqwest::header::RANGE, range)
        .send()
        .await
        .ok()?;
    if r.status() != reqwest::StatusCode::PARTIAL_CONTENT {
        return None;
    }
    // "bytes <first>-<last>/<size>"
    let content_range = r.headers().get(reqwest::header::CONTENT_RANGE)?.to_str().ok()?;
    let (span, size) = content_range.strip_prefix("bytes ")?.split_once('/')?;
    let start = span.split_once('-')?.0.trim().parse().ok()?;
    let size = size.trim().parse().ok()?;
    let body = r.bytes().await.ok()?;
    Some((size, start, body.to_vec()))
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
    download_to_file_in(app, stage, url, dest, sha256, Span::WHOLE).await
}

/// `download_to_file` for one piece of a larger job: progress is reported
/// through `span` (see `Span`); everything else is identical.
pub(super) async fn download_to_file_in(
    app: &tauri::AppHandle,
    stage: &str,
    url: &str,
    dest: &Path,
    sha256: &str,
    span: Span,
) -> AppResult<()> {
    let sha256 = sha256.to_ascii_lowercase();
    let prior = State::load(dest);
    let on_disk = fs::metadata(dest).map(|m| m.len()).unwrap_or(0);

    // A finished payload from an earlier run (its extraction failed, or the
    // launcher was closed between download and install): keep it if it still
    // hashes right, which is the same bar a fresh download has to clear.
    if let Some(st) = &prior {
        if st.complete && st.url == url && st.sha256 == sha256 && on_disk == st.total {
            let (d0, t0) = span.place(0, st.total);
            emit(app, stage, "Checking the earlier download…".into(), if t0 > 0 { d0 as f64 / t0 as f64 * 100.0 } else { 0.0 }, d0, t0);
            if verify_hash(app, stage, dest, &sha256, span).await.is_ok() {
                span.report(app, stage, st.total, st.total, "  (already downloaded)");
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
            download_segmented(app, stage, &client, dest, resumed, span).await?;
        }
        _ => {
            discard(dest);
            download_sequential(app, stage, &client, url, dest, span).await?;
        }
    }

    match verify_hash(app, stage, dest, &sha256, span).await {
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

/// How many whole parts of `size` bytes an interrupted assembly left in
/// `dest`: everything past that boundary is redone. A shorter final part that
/// did land counts as not landed (it is re-fetched, cheaply) because its
/// length alone cannot prove it was appended whole.
pub(super) fn parts_landed(on_disk: u64, size: u64, n: usize) -> usize {
    if size == 0 {
        return 0;
    }
    ((on_disk / size) as usize).min(n.saturating_sub(1))
}

/// Where part `i` is staged while it downloads: beside the payload, named so
/// `verify_hash`'s error message still names the payload.
fn part_path(dest: &Path, i: usize) -> PathBuf {
    let mut s = dest.as_os_str().to_owned();
    s.push(format!(".p{i}"));
    PathBuf::from(s)
}

/// Build `dest` from the parts the manifest lists for it: each part is fetched
/// with `download_to_file` (so it resumes and is hashed on its own), then
/// appended, so at most one part sits beside the growing payload. On success
/// `dest` carries a completed state for `url`, which lets the caller's
/// ordinary `download_to_file(url, dest, sha256)` find it, hash the whole and
/// move on without fetching the single big object; a whole-file mismatch
/// there discards it and falls back to that object, so a bad part list costs
/// bandwidth, never correctness.
pub(super) async fn assemble_parts(
    app: &tauri::AppHandle,
    stage: &str,
    cdn: &str,
    parts: &Parts,
    dest: &Path,
    url: &str,
    sha256: &str,
) -> AppResult<()> {
    let sha256 = sha256.to_ascii_lowercase();
    if let Some(st) = State::load(dest) {
        if st.complete && st.url == url && st.sha256 == sha256 {
            return Ok(()); // an earlier run finished; download_to_file re-checks it
        }
    }
    let n = parts.sha256.len();
    let client = http()?;
    // The last part is the only one whose length the manifest doesn't fix.
    let last_len = client
        .head(format!("{cdn}/{}", parts.path(n - 1)))
        .send()
        .await
        .ok()
        .and_then(|r| r.content_length())
        .unwrap_or(parts.size);
    let total = parts.size * (n as u64 - 1) + last_len;

    let on_disk = fs::metadata(dest).map(|m| m.len()).unwrap_or(0);
    let have = parts_landed(on_disk, parts.size, n);
    let keep = have as u64 * parts.size;
    if on_disk != keep {
        let _ = fs::remove_file(state_path(dest));
        fs::OpenOptions::new().write(true).create(true).open(dest)?.set_len(keep)?;
    }
    if have > 0 {
        Span { offset: 0, total }.report(app, stage, keep, total, "  (resuming)");
    }

    for i in have..n {
        let part = part_path(dest, i);
        let span = Span { offset: i as u64 * parts.size, total };
        download_to_file_in(app, stage, &format!("{cdn}/{}", parts.path(i)), &part, &parts.sha256[i], span).await?;
        let (src, dst) = (part.clone(), dest.to_path_buf());
        tauri::async_runtime::spawn_blocking(move || -> AppResult<()> {
            let mut from = File::open(&src)?;
            let mut to = fs::OpenOptions::new().append(true).open(&dst)?;
            std::io::copy(&mut from, &mut to)?;
            to.flush()?;
            Ok(())
        })
        .await
        .map_err(|e| AppError::detail(ErrorCode::BackgroundTaskFailed, e))??;
        discard(&part);
    }

    let len = fs::metadata(dest)?.len();
    State { url: url.to_string(), total: len, etag: String::new(), sha256, segments: Vec::new(), complete: true }
        .save(dest);
    Ok(())
}

/// Stream `path` through SHA-256 and compare. Reports through `stage` so a
/// 10 GB check is a moving bar, not a hang after the download says 100%.
async fn verify_hash(app: &tauri::AppHandle, stage: &str, path: &Path, expected: &str, span: Span) -> AppResult<()> {
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
                let (d, t) = span.place(done, total);
                let pct = if t > 0 { d as f64 / t as f64 * 100.0 } else { 100.0 };
                emit(&app2, &stage2, format!("Verifying…  {} / {}", human(d), human(t)), pct, d, t);
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
    span: Span,
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
            // Speed over the window since the last tick, same readout as the
            // segmented path's reporter.
            let speed = ((done - last_bytes) as f64 / delta_time.as_secs_f64()) as u64;
            span.report(app, stage, done, total, &format!("  ({}/s)", human(speed)));
            last = Instant::now();
            last_bytes = done;
        }
    }
    span.report(app, stage, done, total.max(done), "  downloaded");
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
    span: Span,
) -> AppResult<()> {
    let total = state.total;
    let already = state.done();
    if already == 0 {
        // Preallocate so every worker can write into its own region.
        File::create(dest).and_then(|f| f.set_len(total).map(|_| ()))?;
    } else {
        span.report(app, stage, already, total, "  (resuming)");
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
                span.report(&app, &stage, d, total, &format!("  ({}/s)", human(speed)));
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
        span.report(app, stage, total, total, "  downloaded");
    }
    result
}

#[cfg(test)]
#[path = "__tests/transfer.rs"]
mod tests;
