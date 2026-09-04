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

pub(super) async fn fetch_remote_game_version(client: &reqwest::Client, cdn: &str) -> Option<String> {
    config_version(&fetch_remote_config(client, cdn).await, "gameversion")
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
