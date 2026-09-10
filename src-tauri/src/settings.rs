use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(default)]
pub struct Settings {
    pub game_path: String,
    /// Prefix command used to run the game on non-Windows hosts,
    /// e.g. "wine" or "umu-run". Ignored on Windows / when empty.
    pub launch_command: String,
    /// Optional WINEPREFIX handed to the launch wrapper (Linux only).
    /// Empty = the wrapper's default prefix.
    pub wine_prefix: String,
    /// Base URL of the account portal (serves web/api.php).
    pub play_base: String,
    pub cdn_base: String,
    /// HTTPS endpoint that validates a live session → username.
    /// The in-game server host the injector connects to is derived from this.
    pub auth_url: String,
    /// Player-count sidecar endpoint (players_sidecar.py).
    pub players_url: String,
    /// Registered username resolved from the stored session via the portal.
    pub username: String,
    /// Role flags resolved alongside the username on each session refresh.
    /// Drive the account subheading (only staff/dev get one).
    pub is_staff: bool,
    pub is_dev: bool,
    /// Tester badge: unlocks the hidden Playtest variant.
    /// A peer of staff/dev, not implied by either.
    pub is_tester: bool,
    /// The session key `/login` exchanged the email + password for. Presented
    /// to `/auth` and the friend routes, and handed to the game through its
    /// environment at launch (`EF_AUTH_TOKEN`) — never written into the game
    /// folder.
    pub auth_token: String,
    /// Public "Spellbreak ID" (the unique username), from email sign-in.
    pub spellbreak_id: String,
    /// Chosen avatar: a headshot id (e.g. "ArchLich"), the "discord" sentinel,
    /// or empty (initials). Resolved to an image by the account pill.
    pub avatar: String,
    /// Linked Discord id + avatar hash, so the pill can render the real Discord
    /// profile picture when the avatar is "discord".
    pub discord_id: String,
    pub discord_avatar: String,
    /// Public email/password sign-in endpoint (POST {"email","password"}).
    pub login_url: String,
    /// First-boot wizard completed.
    pub onboarded: bool,
    /// Optional behaviors (off by default — user opts in via Settings):
    /// close (X) minimizes to the taskbar instead of quitting.
    pub minimize_on_close: bool,
    /// quit the launcher when the game starts.
    pub close_on_launch: bool,
    /// UI language: a tag the frontend catalogues know ("en", "fr"), or ""
    /// for "follow the OS". Resolved in the UI, which is the only side that
    /// holds prose — the backend never reads this.
    pub language: String,
    /// The highest signed-manifest `version` this install has accepted. A
    /// manifest below it is a replay of an old release and is refused, so a
    /// CDN that has been rolled back can't roll the install back with it.
    /// See `download/manifest.rs`.
    pub manifest_version: u64,
}

/// Base the account endpoints hang off. Debug builds aim at the local test env
/// (`npm run test-env`), which serves `/auth`, `/players` and the friend routes,
/// so a fresh dev profile talks to the fixture without anyone hand-editing
/// Settings → URLs. Both are overridable there and the override sticks —
/// this only decides where a profile starts.
///
/// `play_base` stays live even in debug: the test env has no portal API to
/// serve, and 404s from it would be less useful than the real thing. (Patch
/// notes used to be on that list; the test env serves those now — see
/// `feed_url()` in remote.rs.) `cdn_base` has a fixture (test-env/update.mjs)
/// and follows the same rule as the account endpoints — see `cdn_base()`.
fn portal_base() -> &'static str {
    if cfg!(debug_assertions) {
        "http://localhost:8787"
    } else {
        "https://play.elefrac.com"
    }
}

/// Where the updater pulls the version file and the three zips from. Debug
/// builds aim at the local test env (`npm run test-env`), which serves all
/// four from its `update` block, so a dev session drives the update flow
/// against bytes you control rather than asking the live CDN about a build
/// that is behind it by definition.
///
/// Two things follow from that, both deliberate. With no test env running, a
/// debug build simply has no remote version — nothing is offered, nothing is
/// downloaded. And with one running, an update installs *fixture* paks and a
/// stub loader into whatever `game_path` the profile points at, so point that
/// at a copy. Overridable in Settings → URLs either way.
fn cdn_base() -> &'static str {
    if cfg!(debug_assertions) {
        "http://localhost:8787"
    } else {
        "https://cdn.elefrac.com"
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            game_path: String::new(),
            // Proton-GE (via umu-run) is the default runtime — it mirrors the
            // Steam build and handles the mod loader / DXVK far better than
            // plain Wine. Falls back to Wine automatically if umu is absent.
            launch_command: if cfg!(windows) { String::new() } else { "umu-run".into() },
            wine_prefix: String::new(),
            play_base: "https://play.elefrac.com".into(),
            cdn_base: cdn_base().into(),
            auth_url: format!("{}/auth", portal_base()),
            players_url: format!("{}/players", portal_base()),
            username: String::new(),
            is_staff: false,
            is_dev: false,
            is_tester: false,
            auth_token: String::new(),
            spellbreak_id: String::new(),
            avatar: String::new(),
            discord_id: String::new(),
            discord_avatar: String::new(),
            login_url: format!("{}/login", portal_base()),
            onboarded: false,
            minimize_on_close: false,
            close_on_launch: false,
            // Empty = follow the OS; the picker in Settings writes a tag.
            language: String::new(),
            manifest_version: 0,
        }
    }
}

pub fn config_dir(app: &tauri::AppHandle) -> PathBuf {
    let mut dir = app
        .path()
        .app_config_dir()
        .expect("no app config dir available");
    // Debug builds get their own profile under the same app dir, so `tauri dev`
    // can't overwrite the settings — and the session — of the launcher you
    // actually play with. It also makes states the app has no way back to
    // (signed out, pre-onboarding) safe to reach: wreck the dev profile freely.
    if cfg!(debug_assertions) {
        dir.push("dev");
    }
    let _ = fs::create_dir_all(&dir);
    dir
}

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    config_dir(app).join("settings.json")
}

/// Serializes all settings WRITES, so two load-modify-store calls (a sign-in
/// racing the install flow) can't clobber each other and silently drop a field
/// like the session key.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub fn load(app: &tauri::AppHandle) -> Settings {
    let path = settings_path(app);
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        // No file yet (first boot) — a legitimate default.
        Err(_) => return Settings::default(),
    };
    match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            // The file exists but won't parse (corrupted / half-written). Do
            // NOT silently reset to defaults — that is exactly how a saved
            // session vanishes without a trace. Keep the bad file so the loss is
            // visible and recoverable, then fall back to defaults.
            let bak = path.with_extension("json.corrupt");
            let _ = fs::rename(&path, &bak);
            eprintln!(
                "settings: {} was unparseable ({e}); backed up to {} and using defaults",
                path.display(),
                bak.display()
            );
            Settings::default()
        }
    }
}

/// Crash-safe write: serialize to a temp file, then rename over settings.json,
/// so an interrupted write can never leave a half-written config for the next
/// load to treat as corrupt.
fn write_atomic(app: &tauri::AppHandle, s: &Settings) -> AppResult<()> {
    let json = serde_json::to_string_pretty(s)?;
    let path = settings_path(app);
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}

pub fn store(app: &tauri::AppHandle, s: &Settings) -> AppResult<()> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    write_atomic(app, s)
}

/// Load-modify-store under the write lock, so no concurrent writer can slip a
/// whole-settings overwrite between the read and the write and undo an
/// in-flight sign-in. Returns the settings as written.
pub fn mutate(
    app: &tauri::AppHandle,
    f: impl FnOnce(&mut Settings),
) -> AppResult<Settings> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut s = load(app);
    f(&mut s);
    write_atomic(app, &s)?;
    Ok(s)
}

/// The bare host the in-game injector connects to (on :4948), extracted from
/// the auth URL: "https://play.elefrac.com/auth" → "play.elefrac.com".
pub fn game_host(auth_url: &str) -> String {
    let after_scheme = auth_url.split("://").nth(1).unwrap_or(auth_url);
    let host_port = after_scheme.split('/').next().unwrap_or(after_scheme);
    host_port.split(':').next().unwrap_or(host_port).trim().to_string()
}

#[tauri::command]
#[specta::specta]
pub fn get_settings(app: tauri::AppHandle) -> Settings {
    load(&app)
}

#[tauri::command]
#[specta::specta]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> AppResult<()> {
    store(&app, &settings)
}

/// Wipe the stored configuration back to defaults. Returns the fresh
/// settings so the frontend can re-run first-boot onboarding.
#[tauri::command]
#[specta::specta]
pub fn reset_settings(app: tauri::AppHandle) -> AppResult<Settings> {
    let s = Settings::default();
    store(&app, &s)?;
    Ok(s)
}

#[cfg(test)]
#[path = "__tests/settings.rs"]
mod tests;
