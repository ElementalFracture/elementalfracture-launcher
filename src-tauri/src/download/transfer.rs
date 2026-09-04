//! Getting a file off the CDN, in as many pieces as the server allows.

use super::progress::{emit, human};
use crate::error::{AppError, AppResult, ErrorCode};
use std::fs::{self, File};
use std::io::{Seek, SeekFrom, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Parallel connections for large downloads (each takes a byte range).
const SEGMENTS: u64 = 6;
/// Don't bother splitting anything smaller than this per connection.
const MIN_SEGMENT: u64 = 32 * 1024 * 1024;

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

/// Download `url` to `dest`. Probes for HTTP range support first: servers
/// that honor ranges (the CDN does) get a multi-connection segmented
/// download, everything else falls back to a single stream.
pub(super) async fn download_to_file(
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
