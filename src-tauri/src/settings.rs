use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
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
    /// HTTPS endpoint that validates a token → username (POST {"token"}).
    /// The in-game server host the injector connects to is derived from this.
    pub auth_url: String,
    /// Player-count sidecar endpoint (players_sidecar.py).
    pub players_url: String,
    /// Registered username resolved from the auth token via the portal.
    pub username: String,
    /// Role flags resolved alongside the username at token validation.
    /// Drive the account subheading (only staff/dev get one).
    pub is_staff: bool,
    pub is_dev: bool,
    /// The auth token itself — kept here so it survives before a game
    /// folder exists and gets written into Mods/commands when one does.
    pub auth_token: String,
    /// First-boot wizard completed.
    pub onboarded: bool,
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
            cdn_base: "https://cdn.elefrac.com".into(),
            auth_url: "https://play.elefrac.com/auth".into(),
            players_url: "https://play.elefrac.com/players".into(),
            username: String::new(),
            is_staff: false,
            is_dev: false,
            auth_token: String::new(),
            onboarded: false,
        }
    }
}

pub fn config_dir(app: &tauri::AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_config_dir()
        .expect("no app config dir available");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn settings_path(app: &tauri::AppHandle) -> PathBuf {
    config_dir(app).join("settings.json")
}

pub fn load(app: &tauri::AppHandle) -> Settings {
    fs::read_to_string(settings_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn store(app: &tauri::AppHandle, s: &Settings) -> Result<(), String> {
    let json = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    fs::write(settings_path(app), json).map_err(|e| e.to_string())
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
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    store(&app, &settings)
}

/// Wipe the stored configuration back to defaults. Returns the fresh
/// settings so the frontend can re-run first-boot onboarding.
#[tauri::command]
#[specta::specta]
pub fn reset_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let s = Settings::default();
    store(&app, &s)?;
    Ok(s)
}

#[tauri::command]
#[specta::specta]
pub async fn pick_game_dir(app: tauri::AppHandle, title: Option<String>) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .set_title(title.unwrap_or_else(|| "Select your Spellbreak folder (contains g3 and Engine)".into()))
        .blocking_pick_folder()
        .and_then(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}

/// True when the launcher itself runs inside a container (distrobox dev
/// builds) — programs like the browser or wine live on the host there.
#[cfg(target_os = "linux")]
pub fn in_container() -> bool {
    std::path::Path::new("/run/.containerenv").exists()
        || std::path::Path::new("/.dockerenv").exists()
        || std::env::var_os("container").is_some()
}

#[cfg(not(target_os = "linux"))]
pub fn in_container() -> bool {
    false
}

/// When in a container, xdg-open would look for a browser inside the
/// container and silently fail. Hand the URL to the host instead.
#[cfg(target_os = "linux")]
fn host_open(url: &str) -> bool {
    if !in_container() {
        return false;
    }
    for prog in ["distrobox-host-exec", "flatpak-spawn"] {
        let mut cmd = std::process::Command::new(prog);
        if prog == "flatpak-spawn" {
            cmd.arg("--host");
        }
        cmd.arg("xdg-open")
            .arg(url)
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        if cmd.spawn().is_ok() {
            return true;
        }
    }
    false
}

#[cfg(not(target_os = "linux"))]
fn host_open(_url: &str) -> bool {
    false
}

#[tauri::command]
#[specta::specta]
pub fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("only http(s) links can be opened".into());
    }
    if host_open(&url) {
        return Ok(());
    }
    open::that_detached(&url).map_err(|e| e.to_string())
}
