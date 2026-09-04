//! The friend roster, served by the players sidecar next to /players. Every
//! call carries the stored token, so the frontend only ever names a user.

use super::client;
use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;

/// Base URL of the players sidecar (where /friends lives), derived from the
/// configured players URL: "https://play.elefrac.com/players" → ".../".
fn sidecar_base(s: &settings::Settings) -> Option<String> {
    let base = s.players_url.trim();
    if base.is_empty() {
        return None;
    }
    Some(match base.strip_suffix("/players") {
        Some(prefix) => prefix.to_string(),
        None => base.trim_end_matches('/').to_string(),
    })
}

/// POST {token[, username]} to a /friends* endpoint and return its JSON. The
/// token comes from stored settings, so the frontend never handles it — it
/// just names the friend to act on.
async fn friend_call(
    app: &tauri::AppHandle,
    path: &str,
    username: Option<String>,
) -> AppResult<serde_json::Value> {
    let s = settings::load(app);
    let token = s.auth_token.trim().to_string();
    if token.is_empty() {
        return Err(AppError::new(ErrorCode::NoAccountToken));
    }
    let base = sidecar_base(&s)
        .ok_or_else(|| AppError::new(ErrorCode::PlayersUrlNotConfigured))?;
    let mut body = serde_json::json!({ "token": token });
    if let Some(name) = username {
        body["username"] = serde_json::Value::String(name);
    }
    client()?
        .post(format!("{base}{path}"))
        .json(&body)
        .send()
        .await?
        .json()
        .await
        .map_err(AppError::from)
}

/// Friend list + statuses (also serves as the launcher presence heartbeat).
#[tauri::command]
#[specta::specta]
pub async fn friends_list(app: tauri::AppHandle) -> AppResult<serde_json::Value> {
    friend_call(&app, "/friends", None).await
}

/// Send a friend request to (or auto-accept a reciprocal request from) a username.
#[tauri::command]
#[specta::specta]
pub async fn friend_add(app: tauri::AppHandle, username: String) -> AppResult<serde_json::Value> {
    friend_call(&app, "/friends/add", Some(username)).await
}

/// Accept a pending incoming request from a username.
#[tauri::command]
#[specta::specta]
pub async fn friend_accept(app: tauri::AppHandle, username: String) -> AppResult<serde_json::Value> {
    friend_call(&app, "/friends/accept", Some(username)).await
}

/// Unfriend / decline / cancel — drops any relationship with a username.
#[tauri::command]
#[specta::specta]
pub async fn friend_remove(app: tauri::AppHandle, username: String) -> AppResult<serde_json::Value> {
    friend_call(&app, "/friends/remove", Some(username)).await
}
