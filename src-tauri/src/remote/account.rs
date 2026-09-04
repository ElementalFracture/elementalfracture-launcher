//! Signing in, and keeping the cached identity honest.

use super::client;
use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;
use serde::Serialize;

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
pub async fn refresh_account(app: tauri::AppHandle) -> AppResult<Option<Account>> {
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

/// Classify a `{"error":"banned", ...}` body into the suspension code that
/// fits it, carrying the parts the sentence needs. `ends` (a human date) or a
/// non-null `expires_at` marks a timed suspension; both null means permanent.
/// A meaningful `reason` (non-empty and not the literal "banned") rides along
/// for the catalogue to append; the UI leaves it off when it isn't there.
fn suspension_error(body: &serde_json::Value) -> AppError {
    let ends = body.get("ends").and_then(|v| v.as_str()).unwrap_or("").trim();
    let has_expiry =
        !ends.is_empty() || body.get("expires_at").and_then(|v| v.as_i64()).is_some();

    // A timestamp with no human date reads as "suspended", not "until when" —
    // there is no date to put in that sentence.
    let mut err = if has_expiry && !ends.is_empty() {
        AppError::new(ErrorCode::AccountSuspendedUntil).with("ends", ends)
    } else {
        AppError::new(ErrorCode::AccountSuspended).with("permanent", !has_expiry)
    };

    let reason = body.get("reason").and_then(|v| v.as_str()).unwrap_or("").trim();
    if !reason.is_empty() && !reason.eq_ignore_ascii_case("banned") {
        err = err.with("reason", reason);
    }
    err
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
) -> AppResult<TokenResult> {
    let email = email.trim().to_string();
    if email.is_empty() || password.is_empty() {
        return Err(AppError::new(ErrorCode::EnterEmailAndPassword));
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
                None => return Err(AppError::new(ErrorCode::SignInNotConfigured)),
            }
        }
    };

    let resp = client()?
        .post(&url)
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| AppError::detail(ErrorCode::SignInUnreachable, e))?;

    let body: serde_json::Value = resp.json().await.unwrap_or_default();
    if body.get("ok").and_then(|v| v.as_bool()) != Some(true) {
        let err = body.get("error").and_then(|v| v.as_str()).unwrap_or("");
        // A ban carries richer fields (a human end date and a free-text reason),
        // so it gets its own message instead of the flat catch-all string.
        if err == "banned" {
            return Err(suspension_error(&body));
        }
        return Err(AppError::new(match err {
            "invalid_credentials" => ErrorCode::WrongCredentials,
            "email_unverified" => ErrorCode::EmailUnverified,
            "rate_limited" => ErrorCode::RateLimited,
            _ => ErrorCode::SignInFailed,
        }));
    }

    let token = body
        .get("token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if token.is_empty() {
        return Err(AppError::new(ErrorCode::SignInFailed));
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
pub async fn logout(app: tauri::AppHandle) -> AppResult<()> {
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
