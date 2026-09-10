//! The two live counters the home view polls: players online, and the Discord
//! events the sidecar mirrors.

use super::client;
use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;

/// Total online players from the players sidecar (players_sidecar.py),
/// which follows the servers' broadcast JSON streams — the same feed the
/// Discord bot's match tracker consumes. Falls back to the portal HTTP API.
#[tauri::command]
#[specta::specta]
pub async fn get_players(app: tauri::AppHandle) -> AppResult<serde_json::Value> {
    let s = settings::load(&app);

    if !s.players_url.trim().is_empty() {
        if let Ok(resp) = client()?.get(s.players_url.trim()).send().await {
            if let Ok(v) = resp.json::<serde_json::Value>().await {
                if v.get("online").is_some() {
                    return Ok(v);
                }
            }
        }
    }

    let url = format!("{}/api.php?players", s.play_base.trim_end_matches('/'));
    client()?
        .get(&url)
        .send()
        .await
        .and_then(|r| r.error_for_status())?
        .json()
        .await
        .map_err(AppError::from)
}

/// Live Discord events, served by the players sidecar (pushed there by the
/// Discord bot). The endpoint lives next to /players on the same service.
#[tauri::command]
#[specta::specta]
pub async fn get_events(app: tauri::AppHandle) -> AppResult<serde_json::Value> {
    let s = settings::load(&app);
    let base = s.players_url.trim();
    if base.is_empty() {
        return Err(AppError::new(ErrorCode::PlayersUrlNotConfigured));
    }
    let url = match base.strip_suffix("/players") {
        Some(prefix) => format!("{prefix}/events"),
        None => format!("{}/events", base.trim_end_matches('/')),
    };
    client()?
        .get(&url)
        .send()
        .await
        .and_then(|r| r.error_for_status())?
        .json()
        .await
        .map_err(AppError::from)
}
