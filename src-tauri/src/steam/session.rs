//! Running under Steam, as a non-Steam shortcut or as Spellbreak's Play.
//!
//! Players start the launcher from Steam to get Steam Input: controller remaps
//! (sticks and triggers onto WASD and friends) only apply while Steam thinks
//! the game is running. Two things break that out of the box.
//!
//! - Steam injects its overlay into the process it starts and every child.
//!   The webview's renderer processes are children, and the overlay hooking
//!   their GPU drawing takes the window down before it paints. Under Steam
//!   the webview draws in software instead (the launcher UI doesn't need a
//!   GPU), and on Linux the overlay preload is kept away from WebKit and
//!   handed back to the game, which is the process that wants it.
//! - Steam ends the session when the process it started exits. A launcher
//!   that quits once the game is up drops the remap mid-match, so under Steam
//!   a quit or close while the game runs becomes a minimize, and the launcher
//!   leaves when the game does.

use std::process::Child;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use tauri::Manager;

/// The overlay preload Steam gave us, captured before it's stripped.
#[cfg(target_os = "linux")]
static OVERLAY_PRELOAD: OnceLock<Option<std::ffi::OsString>> = OnceLock::new();
static UNDER_STEAM: OnceLock<bool> = OnceLock::new();
static GAME_RUNNING: AtomicBool = AtomicBool::new(false);
/// A quit that arrived while the game was running, carried out when it exits.
static QUIT_DEFERRED: AtomicBool = AtomicBool::new(false);

/// Steam sets these for everything it launches, shortcuts included.
fn steam_env_present(var: impl Fn(&str) -> bool) -> bool {
    ["SteamGameId", "SteamClientLaunch", "SteamOverlayGameId"]
        .into_iter()
        .any(var)
}

/// Library paths from Steam's own runtime, which it hands to shortcuts it
/// starts. Ahead of the system's they shadow libraries the AppImage takes from
/// the host on purpose (libwayland under Mesa's EGL: a blank window).
#[cfg(target_os = "linux")]
pub fn steam_runtime_paths(ld_library_path: &str) -> bool {
    ld_library_path
        .split(':')
        .any(|p| p.contains("steam-runtime") || p.contains("/ubuntu12_32") || p.contains("/ubuntu12_64"))
}

/// The dynamic loader reads LD_LIBRARY_PATH once, at exec, so the only way
/// out from under Steam's runtime is to start again without it. Steam keeps
/// the values it replaced in SYSTEM_*; those go back in.
#[cfg(target_os = "linux")]
fn leave_steam_runtime() {
    use std::os::unix::process::CommandExt;
    const MARKER: &str = "EF_LEFT_STEAM_RUNTIME";
    let Some(system) = std::env::var_os("SYSTEM_LD_LIBRARY_PATH") else { return };
    if std::env::var_os(MARKER).is_some()
        || !std::env::var("LD_LIBRARY_PATH").is_ok_and(|p| steam_runtime_paths(&p))
    {
        return;
    }
    let Some(target) = std::env::var_os("APPIMAGE")
        .map(std::path::PathBuf::from)
        .or_else(|| std::env::current_exe().ok())
    else {
        return;
    };
    let mut cmd = std::process::Command::new(target);
    cmd.args(std::env::args_os().skip(1))
        .env(MARKER, "1")
        .env("LD_LIBRARY_PATH", system);
    if let Some(path) = std::env::var_os("SYSTEM_PATH") {
        cmd.env("PATH", path);
    }
    // Only returns on failure, and then carrying on as we are is the best left.
    let _ = cmd.exec();
}

/// Call first thing in `main`, while the process is still single threaded:
/// it reads and edits the environment the webview's processes inherit.
pub fn init() {
    #[cfg(target_os = "linux")]
    leave_steam_runtime();
    let under = steam_env_present(|k| std::env::var_os(k).is_some_and(|v| !v.is_empty()));
    let _ = UNDER_STEAM.set(under);
    #[cfg(target_os = "linux")]
    {
        let preload = std::env::var_os("LD_PRELOAD");
        let has_overlay = preload
            .as_ref()
            .is_some_and(|p| p.to_string_lossy().contains("gameoverlayrenderer"));
        if under && has_overlay {
            let _ = OVERLAY_PRELOAD.set(preload);
            std::env::remove_var("LD_PRELOAD");
        }
    }
}

pub fn under_steam() -> bool {
    UNDER_STEAM.get().copied().unwrap_or(false)
}

/// Extra WebView2 arguments for this session. Starts from wry's defaults,
/// which an explicit value replaces rather than extends.
pub fn browser_args() -> Option<&'static str> {
    under_steam().then_some(
        "--disable-features=msWebOOUI,msPdfOOUI --disable-gpu --disable-gpu-compositing",
    )
}

/// Give the game back the overlay the launcher's webview was kept away from.
pub fn restore_game_env(cmd: &mut std::process::Command) {
    #[cfg(target_os = "linux")]
    {
        if let Some(Some(preload)) = OVERLAY_PRELOAD.get() {
            cmd.env("LD_PRELOAD", preload);
        }
        // Started as Spellbreak through the compatibility tool, Steam describes
        // its own Proton prefix in these. The launcher's runtime brings its own.
        for (k, _) in std::env::vars_os() {
            if k.to_string_lossy().starts_with("STEAM_COMPAT_") {
                cmd.env_remove(k);
            }
        }
    }
    #[cfg(not(target_os = "linux"))]
    let _ = cmd;
}

/// Whether a game this launcher started is still running. The self-update waits for it: under Steam the
/// launcher process is the session the game runs in.
pub fn game_running() -> bool {
    GAME_RUNNING.load(Ordering::SeqCst)
}

/// Reap the game when it exits, and under Steam finish a quit that was held
/// back so the session outlived the launcher window.
pub fn watch_game(app: &tauri::AppHandle, mut child: Child) {
    GAME_RUNNING.store(true, Ordering::SeqCst);
    let app = app.clone();
    std::thread::spawn(move || {
        let _ = child.wait();
        GAME_RUNNING.store(false, Ordering::SeqCst);
        if QUIT_DEFERRED.swap(false, Ordering::SeqCst) {
            app.exit(0);
        }
    });
}

/// Quickstart has no window to minimize: the launcher's whole job is the
/// game, so it leaves when the game does.
pub fn quit_with_game(on: bool) {
    QUIT_DEFERRED.store(on, Ordering::SeqCst);
}

/// Whether a quit or close should wait for the game. When it should, the
/// window is minimized now and the launcher exits with the game.
pub fn defer_quit(app: &tauri::AppHandle) -> bool {
    if !under_steam() || !GAME_RUNNING.load(Ordering::SeqCst) {
        return false;
    }
    QUIT_DEFERRED.store(true, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
    }
    // The game may have exited between the check and the flag.
    let exited_meanwhile = !GAME_RUNNING.load(Ordering::SeqCst) && QUIT_DEFERRED.swap(false, Ordering::SeqCst);
    !exited_meanwhile
}

#[cfg(test)]
#[path = "__tests/session.rs"]
mod tests;
