//! The `install-progress` event every long-running CDN job reports through.

use serde::Serialize;
use tauri::Emitter;

#[derive(Serialize, Clone)]
struct Progress {
    stage: String,
    message: String,
    percent: f64,
    done: u64,
    total: u64,
}

pub(super) fn emit(app: &tauri::AppHandle, stage: &str, message: String, percent: f64, done: u64, total: u64) {
    let _ = app.emit(
        "install-progress",
        Progress { stage: stage.into(), message, percent, done, total },
    );
}

pub(super) fn human(bytes: u64) -> String {
    const UNITS: [&str; 4] = ["B", "KB", "MB", "GB"];
    let mut v = bytes as f64;
    let mut u = 0;
    while v >= 1024.0 && u < UNITS.len() - 1 {
        v /= 1024.0;
        u += 1;
    }
    format!("{v:.1} {}", UNITS[u])
}
