use crate::settings;
use serde::Serialize;
use std::time::Duration;

const FEED_URL: &str = "https://docs.elefrac.com/patchnotes/rss.xml";

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .user_agent(concat!("ef-launcher/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

/// Total online players from the players sidecar (players_sidecar.py),
/// which follows the servers' broadcast JSON streams — the same feed the
/// Discord bot's match tracker consumes. Falls back to the portal HTTP API.
#[tauri::command]
#[specta::specta]
pub async fn get_players(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
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
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

#[derive(Serialize, specta::Type)]
pub struct TokenResult {
    pub username: Option<String>,
    pub is_staff: bool,
    pub is_dev: bool,
    pub verified: bool,
    pub warning: Option<String>,
}

/// Save the token, then validate it against the auth URL (POST {"token"}),
/// which returns {"ok", "username", "is_staff", "is_dev"}. The token is
/// stored even when the lookup fails, so play still works offline.
#[tauri::command]
#[specta::specta]
pub async fn apply_token(app: tauri::AppHandle, token: String) -> Result<TokenResult, String> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err("Token is empty.".into());
    }

    let mut s = settings::load(&app);
    s.auth_token = token.clone();
    // A new token means an as-yet-unverified identity — clear the name and role
    // flags so a failed lookup can't leave the previous account's badge, or its
    // name, showing. Only the success path below fills them back in, which is
    // what makes a non-empty `username` mean "this token was accepted": the
    // token itself is stored either way, so it can't answer that on its own.
    s.username.clear();
    s.is_staff = false;
    s.is_dev = false;
    settings::store(&app, &s)?;

    let unverified = |warning: String| TokenResult {
        username: None,
        is_staff: false,
        is_dev: false,
        verified: false,
        warning: Some(warning),
    };

    let resp = match client()?
        .post(s.auth_url.trim())
        .json(&serde_json::json!({ "token": token }))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return Ok(unverified(format!("Token saved, but account lookup failed: {e}"))),
    };

    let body: serde_json::Value = resp.json().await.unwrap_or_default();
    if body.get("ok").and_then(|v| v.as_bool()) == Some(true) {
        if let Some(username) = body.get("username").and_then(|v| v.as_str()) {
            let is_staff = body.get("is_staff").and_then(|v| v.as_bool()).unwrap_or(false);
            let is_dev = body.get("is_dev").and_then(|v| v.as_bool()).unwrap_or(false);
            let mut s = settings::load(&app);
            s.username = username.to_string();
            s.is_staff = is_staff;
            s.is_dev = is_dev;
            settings::store(&app, &s)?;
            return Ok(TokenResult {
                username: Some(username.to_string()),
                is_staff,
                is_dev,
                verified: true,
                warning: None,
            });
        }
    }
    Ok(unverified("Token saved, but the auth server doesn't recognize it.".into()))
}

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
) -> Result<serde_json::Value, String> {
    let s = settings::load(app);
    let token = s.auth_token.trim().to_string();
    if token.is_empty() {
        return Err("No account token set.".into());
    }
    let base = sidecar_base(&s).ok_or("players URL not configured")?;
    let mut body = serde_json::json!({ "token": token });
    if let Some(name) = username {
        body["username"] = serde_json::Value::String(name);
    }
    client()?
        .post(format!("{base}{path}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

/// Friend list + statuses (also serves as the launcher presence heartbeat).
#[tauri::command]
#[specta::specta]
pub async fn friends_list(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    friend_call(&app, "/friends", None).await
}

/// Send a friend request to (or auto-accept a reciprocal request from) a username.
#[tauri::command]
#[specta::specta]
pub async fn friend_add(app: tauri::AppHandle, username: String) -> Result<serde_json::Value, String> {
    friend_call(&app, "/friends/add", Some(username)).await
}

/// Accept a pending incoming request from a username.
#[tauri::command]
#[specta::specta]
pub async fn friend_accept(app: tauri::AppHandle, username: String) -> Result<serde_json::Value, String> {
    friend_call(&app, "/friends/accept", Some(username)).await
}

/// Unfriend / decline / cancel — drops any relationship with a username.
#[tauri::command]
#[specta::specta]
pub async fn friend_remove(app: tauri::AppHandle, username: String) -> Result<serde_json::Value, String> {
    friend_call(&app, "/friends/remove", Some(username)).await
}

/// Live Discord events, served by the players sidecar (pushed there by the
/// Discord bot). The endpoint lives next to /players on the same service.
#[tauri::command]
#[specta::specta]
pub async fn get_events(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let s = settings::load(&app);
    let base = s.players_url.trim();
    if base.is_empty() {
        return Err("players URL not configured".into());
    }
    let url = match base.strip_suffix("/players") {
        Some(prefix) => format!("{prefix}/events"),
        None => format!("{}/events", base.trim_end_matches('/')),
    };
    client()?
        .get(&url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

#[derive(Serialize, specta::Type)]
pub struct NewsItem {
    pub title: String,
    pub body: String,
    pub date: String,
    pub url: String,
}

/// "What's new" straight from the patchnotes RSS feed on docs.elefrac.com.
#[tauri::command]
#[specta::specta]
pub async fn get_news() -> Result<Vec<NewsItem>, String> {
    let xml = client()?
        .get(FEED_URL)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    Ok(parse_rss(&xml))
}

fn tag_content(block: &str, tag: &str) -> Option<String> {
    let start = block.find(&format!("<{tag}"))?;
    let rest = &block[start..];
    let after = &rest[rest.find('>')? + 1..];
    let inner = &after[..after.find(&format!("</{tag}>"))?];
    let mut text = inner.trim().to_string();
    if let Some(s) = text.strip_prefix("<![CDATA[") {
        text = s.strip_suffix("]]>").unwrap_or(s).trim().to_string();
    }
    Some(
        text.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'"),
    )
}

// "Sun, 24 Aug 2025 00:00:00 GMT" → "24 Aug 2025"
fn format_date(d: String) -> String {
    let parts: Vec<&str> = d.split_whitespace().collect();
    if parts.len() >= 4 {
        format!("{} {} {}", parts[1], parts[2], parts[3])
    } else {
        d
    }
}

fn parse_rss(xml: &str) -> Vec<NewsItem> {
    xml.split("<item>")
        .skip(1)
        .filter_map(|chunk| {
            let block = chunk.split("</item>").next()?;
            Some(NewsItem {
                title: tag_content(block, "title")?,
                body: tag_content(block, "description").unwrap_or_default(),
                date: tag_content(block, "pubDate").map(format_date).unwrap_or_default(),
                url: tag_content(block, "link").unwrap_or_default(),
            })
        })
        .take(8)
        .collect()
}
