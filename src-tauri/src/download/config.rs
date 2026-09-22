//! The launcher's remote configuration: one ini file on the CDN that carries
//! both version tracks and anything else we want to change without shipping a
//! new build.

use super::transfer::http;
use crate::{game, settings};
use std::time::Duration;

/// All remote launcher configuration lives in one ini file on the CDN:
/// {cdn}/launcher/config.ini. It carries both version tracks
/// (GameVersion / LauncherVersion) and has room for any future settings.
/// Parsed leniently: `key=value` lines, `[sections]` skipped, `;`/`#`
/// comments, UTF-8 or the old UTF-16LE+BOM. Keys are matched
/// case-insensitively.
fn parse_ini(text: &str) -> std::collections::HashMap<String, String> {
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

pub(super) async fn fetch_remote_config(
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

/// The (game, mod) versions this variant should be on, in one fetch of config.ini.
///
/// GameVersion is the balance pak, ModVersion the DLL package; each moves on its own release, and the
/// appserver gates on them separately. Playtest reads its own keys when the config defines them, so a
/// test round can sit on its own labels ("7.0.0-lev-rc" / "3.17.1-lev-rc"), and falls back to the
/// production pair when it does not, rather than leaving a playtest install with no versions at all.
pub(super) async fn fetch_remote_versions_for_variant(
    client: &reqwest::Client,
    cdn: &str,
    variant: &str,
) -> (Option<String>, Option<String>) {
    let cfg = fetch_remote_config(client, cdn).await;
    let game = config_version(&cfg, "gameversion");
    let mods = config_version(&cfg, "modversion");
    if variant == "playtest" {
        return (
            config_version(&cfg, "playtestgameversion")
                .or_else(|| config_version(&cfg, "playtestversion"))
                .or(game),
            config_version(&cfg, "playtestmodversion").or(mods),
        );
    }
    (game, mods)
}

pub(super) async fn fetch_remote_launcher_version(client: &reqwest::Client, cdn: &str) -> Option<String> {
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

#[cfg(test)]
#[path = "__tests/config.rs"]
mod tests;
