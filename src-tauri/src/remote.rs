use crate::settings;
use serde::Serialize;
use std::time::Duration;

const FEED_URL: &str = "https://elefrac.com/patchnotes/feed/";

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
    pub is_tester: bool,
    pub verified: bool,
    pub warning: Option<String>,
}


/// The account behind a validated token, as the portal reports it.
#[derive(Serialize, specta::Type)]
pub struct Account {
    pub username: String,
    pub is_staff: bool,
    pub is_dev: bool,
    pub is_tester: bool,
}

/// The role flags out of an `/auth` body. Older auth servers don't send
/// `is_tester` yet — absent reads as false rather than as a refusal.
fn read_account(body: &serde_json::Value, username: &str) -> Account {
    let flag = |key: &str| body.get(key).and_then(|v| v.as_bool()).unwrap_or(false);
    Account {
        username: username.to_string(),
        is_staff: flag("is_staff"),
        is_dev: flag("is_dev"),
        is_tester: flag("is_tester"),
    }
}

/// Re-validate the STORED token and refresh the cached role flags, so a
/// freshly granted staff/dev/tester badge shows up without a restart, and an
/// expired token flips the account pill to "session expired" instead of showing
/// a signed-in name that no longer works.
///
/// Three outcomes: a valid token refreshes the roles (returns the account); an
/// explicit `{"ok": false}` clears the cached identity so the pill prompts a new
/// sign-in (returns the emptied account); anything else (a network blip or a
/// malformed reply) is transient and leaves everything on disk untouched
/// (returns `None`) — a blip must never cost someone their badge.
#[tauri::command]
#[specta::specta]
pub async fn refresh_account(app: tauri::AppHandle) -> Result<Option<Account>, String> {
    let s = settings::load(&app);
    let token = s.auth_token.trim().to_string();
    if token.is_empty() {
        return Ok(None);
    }

    let resp = match client()?
        .post(s.auth_url.trim())
        .json(&serde_json::json!({ "token": token }))
        .send()
        .await
    {
        Ok(r) => r,
        // Network failure: don't touch the stored roles, just report no refresh.
        Err(_) => return Ok(None),
    };

    let body: serde_json::Value = resp.json().await.unwrap_or_default();
    match body.get("ok").and_then(|v| v.as_bool()) {
        Some(true) => {
            if let Some(username) = body.get("username").and_then(|v| v.as_str()) {
                let account = read_account(&body, username);
                // Avatar + Discord are only updated when /auth actually returns them
                // (an older sidecar omits them), so an out-of-band change shows up on
                // the 60s refresh without a re-login, and a blip never clears them.
                let avatar = body.get("avatar").and_then(|v| v.as_str()).map(str::to_string);
                let discord_id = body.get("discord_id").and_then(|v| v.as_str()).map(str::to_string);
                let discord_avatar = body.get("discord_avatar").and_then(|v| v.as_str()).map(str::to_string);
                settings::mutate(&app, |s| {
                    s.username = account.username.clone();
                    s.is_staff = account.is_staff;
                    s.is_dev = account.is_dev;
                    s.is_tester = account.is_tester;
                    if let Some(a) = &avatar { s.avatar = a.clone(); }
                    if let Some(d) = &discord_id { s.discord_id = d.clone(); }
                    if let Some(d) = &discord_avatar { s.discord_avatar = d.clone(); }
                })?;
                return Ok(Some(account));
            }
            Ok(None)
        }
        // The auth server explicitly rejected the stored token (expired or revoked).
        // Clear the cached identity so the account pill flips to a "session expired,
        // sign in again" prompt; keep the token itself so the pill can tell "expired"
        // apart from "never signed in". Return the now-empty account (not None) so the
        // UI re-reads and reflects the change. A missing `ok` (malformed reply or a
        // hiccup) is treated as transient and left alone, like a network blip.
        Some(false) => {
            settings::mutate(&app, |s| {
                s.username.clear();
                s.spellbreak_id.clear();
                s.avatar.clear();
                s.discord_id.clear();
                s.discord_avatar.clear();
                s.is_staff = false;
                s.is_dev = false;
                s.is_tester = false;
            })?;
            Ok(Some(Account {
                username: String::new(),
                is_staff: false,
                is_dev: false,
                is_tester: false,
            }))
        }
        None => Ok(None),
    }
}

/// Build the user-facing suspension message from a `{"error":"banned", ...}`
/// body. `ends` (a human date string) or a non-null `expires_at` marks a timed
/// suspension; both null means permanent. A meaningful `reason` (non-empty and
/// not the literal "banned") is appended on its own line. No em-dashes.
fn suspension_message(body: &serde_json::Value) -> String {
    let ends = body.get("ends").and_then(|v| v.as_str()).unwrap_or("").trim();
    let has_expiry = !ends.is_empty()
        || body.get("expires_at").and_then(|v| v.as_i64()).is_some();

    let mut msg = if has_expiry && !ends.is_empty() {
        format!("This account has been suspended. The suspension will end on {ends}.")
    } else if has_expiry {
        // A timestamp with no human date: state it ends without a date.
        "This account has been suspended.".to_string()
    } else {
        "This account has been permanently suspended.".to_string()
    };

    let reason = body.get("reason").and_then(|v| v.as_str()).unwrap_or("").trim();
    if !reason.is_empty() && !reason.eq_ignore_ascii_case("banned") {
        msg.push_str(&format!("\nReason: {reason}"));
    }
    msg
}

/// Email/password sign-in (the same account the website uses). POSTs to the
/// public `/login` endpoint (no shared key: the launcher is a client), which
/// returns the token + profile. On success the token/username/avatar/roles are
/// stored, so play and the account pill work exactly as after a token paste —
/// only now the identity comes from an email + password instead of a pasted
/// token. Returns Err(message) on any auth failure so the modal can show it
/// without saving or closing.
#[tauri::command]
#[specta::specta]
pub async fn login_email(
    app: tauri::AppHandle,
    email: String,
    password: String,
) -> Result<TokenResult, String> {
    let email = email.trim().to_string();
    if email.is_empty() || password.is_empty() {
        return Err("Enter your email and password.".into());
    }

    let s = settings::load(&app);
    let url = {
        let u = s.login_url.trim();
        if !u.is_empty() {
            u.to_string()
        } else {
            // Derive from the auth URL's origin if login_url was blanked.
            match s.auth_url.trim().strip_suffix("/auth") {
                Some(base) => format!("{base}/login"),
                None => return Err("Sign-in is not configured.".into()),
            }
        }
    };

    let resp = client()?
        .post(&url)
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Couldn't reach the sign-in service: {e}"))?;

    let body: serde_json::Value = resp.json().await.unwrap_or_default();
    if body.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let err = body.get("error").and_then(|v| v.as_str()).unwrap_or("");
        // A ban carries richer fields (a human end date and a free-text reason),
        // so it gets its own message instead of the flat catch-all string.
        if err == "banned" {
            return Err(suspension_message(&body));
        }
        return Err(match err {
            "invalid_credentials" => "Wrong email or password.",
            "email_unverified" => "Verify your email first, check your inbox for the code.",
            "rate_limited" => "Too many attempts. Please wait a few minutes.",
            _ => "Sign-in failed. Please try again.",
        }
        .to_string());
    }

    let token = body
        .get("token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if token.is_empty() {
        return Err("Sign-in failed. Please try again.".into());
    }
    let username = body
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let account = read_account(&body, &username);
    let str_field = |k: &str| {
        body.get(k)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    };
    let spellbreak_id = str_field("spellbreak_id");
    let avatar = str_field("avatar");
    let discord_id = str_field("discord_id");
    let discord_avatar = str_field("discord_avatar");

    settings::mutate(&app, |s| {
        s.auth_token = token.clone();
        s.username = account.username.clone();
        s.spellbreak_id = spellbreak_id.clone();
        s.avatar = avatar.clone();
        s.discord_id = discord_id.clone();
        s.discord_avatar = discord_avatar.clone();
        s.is_staff = account.is_staff;
        s.is_dev = account.is_dev;
        s.is_tester = account.is_tester;
    })?;

    Ok(TokenResult {
        username: Some(account.username),
        is_staff: account.is_staff,
        is_dev: account.is_dev,
        is_tester: account.is_tester,
        verified: true,
        warning: None,
    })
}

/// Sign out: clear the stored identity (token, name, avatar, roles, Discord).
#[tauri::command]
#[specta::specta]
pub async fn logout(app: tauri::AppHandle) -> Result<(), String> {
    settings::mutate(&app, |s| {
        s.auth_token.clear();
        s.username.clear();
        s.spellbreak_id.clear();
        s.avatar.clear();
        s.discord_id.clear();
        s.discord_avatar.clear();
        s.is_staff = false;
        s.is_dev = false;
        s.is_tester = false;
    })?;
    Ok(())
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

/// "What's new" straight from the patchnotes RSS feed on elefrac.com (the WordPress blog).
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
