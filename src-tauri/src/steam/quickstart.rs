//! Quickstart: Play on Spellbreak in Steam goes straight into the game.
//!
//! Only when the launcher was started as Spellbreak through the Steam link and
//! the player left quickstart on. No window is opened: the same guards the
//! Play button runs are checked, the game starts, and the launcher leaves when
//! it exits. Holding Shift while pressing Play opens the launcher instead (to
//! switch game modes, say), and so does anything a player needs to act on: a
//! missing install, a signed-out session, a game or launcher update.

use super::link::SPELLBREAK_APPID;
use super::session::{quit_with_game, under_steam};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{download, game, remote, settings};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

/// The same bound the Play button puts on its update check: a launcher that
/// can't reach the CDN still starts the game.
const CHECK_TIMEOUT: Duration = Duration::from_secs(3);

/// Why quickstart handed over to the launcher, for the window to show once.
static NOTICE: Mutex<Option<AppError>> = Mutex::new(None);

/// Steam names the app it started in both variables; the link is the only way
/// the launcher gets started as Spellbreak.
fn started_as_spellbreak() -> bool {
    ["SteamAppId", "SteamGameId"]
        .iter()
        .any(|k| std::env::var(k).is_ok_and(|v| v == SPELLBREAK_APPID))
}

#[cfg(windows)]
pub fn shift_held() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_SHIFT};
    // The high bit is "down". This thread has read no input yet, so Windows
    // seeds the answer from the keyboard as it is now, which is all we need;
    // GetAsyncKeyState would say the same, but its import alone reads as a
    // keylogger to antivirus heuristics.
    unsafe { (GetKeyState(VK_SHIFT as i32) as u16) & 0x8000 != 0 }
}

/// Read through X11, which Steam's own client window is, so the key is seen
/// while Steam has focus. A Wayland-only session has no way to ask, and reads
/// as not held.
#[cfg(target_os = "linux")]
pub fn shift_held() -> bool {
    use x11_dl::{keysym, xlib};
    if std::env::var_os("DISPLAY").is_none() {
        return false;
    }
    let Ok(x) = xlib::Xlib::open() else { return false };
    unsafe {
        let display = (x.XOpenDisplay)(std::ptr::null());
        if display.is_null() {
            return false;
        }
        let mut keys = [0 as std::os::raw::c_char; 32];
        (x.XQueryKeymap)(display, keys.as_mut_ptr());
        let held = [keysym::XK_Shift_L, keysym::XK_Shift_R].iter().any(|&sym| {
            let code = (x.XKeysymToKeycode)(display, sym as xlib::KeySym) as usize;
            code != 0 && (keys[code / 8] as u8) & (1 << (code % 8)) != 0
        });
        (x.XCloseDisplay)(display);
        held
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
pub fn shift_held() -> bool {
    false
}

/// Whether this start should skip the window. Decided before any window
/// exists, so Shift is read while the player is still holding it.
pub fn wanted(app: &tauri::AppHandle) -> bool {
    under_steam()
        && started_as_spellbreak()
        && settings::load(app).steam_autostart
        && !shift_held()
}

/// Everything Play checks, then Play. `Err(None)` opens the launcher with
/// nothing to explain (an update is on its own screen, Shift was held);
/// `Err(Some(e))` opens it with the reason.
pub async fn run(app: &tauri::AppHandle) -> Result<(), Option<AppError>> {
    let s = settings::load(app);
    if s.game_path.is_empty() {
        return Err(Some(AppError::new(ErrorCode::NoGameFolder)));
    }
    if game::find_exe(&PathBuf::from(&s.game_path)).is_none() {
        return Err(None);
    }
    if s.auth_token.trim().is_empty() || s.username.is_empty() {
        return Err(Some(AppError::new(ErrorCode::NotSignedIn)));
    }

    // Side by side, so the wait is the slowest check rather than their sum.
    use tauri::async_runtime::spawn;
    use tokio::time::timeout;
    let versions = spawn(timeout(CHECK_TIMEOUT, download::get_versions(app.clone())));
    let launcher = spawn(timeout(CHECK_TIMEOUT, download::get_launcher_update(app.clone())));
    let account = spawn(timeout(CHECK_TIMEOUT, remote::refresh_account(app.clone())));
    let versions = versions.await.ok().and_then(Result::ok);
    let launcher = launcher.await.ok().and_then(Result::ok);
    let account = account.await.ok().and_then(Result::ok);
    // An explicit rejection empties the account; a blip or timeout leaves it be.
    if matches!(&account, Some(Ok(Some(a))) if a.username.is_empty()) {
        return Err(Some(AppError::new(ErrorCode::NotSignedIn)));
    }
    if versions.is_some_and(|v| v.remote.is_some() && v.local != v.remote) {
        return Err(None);
    }
    if launcher.is_some_and(|l| l.update) {
        return Err(None);
    }
    // The checks took a moment; a player who reached for Shift late still counts.
    if shift_held() {
        return Err(None);
    }

    quit_with_game(true);
    game::launch_game(app.clone()).map_err(|e| {
        quit_with_game(false);
        Some(e)
    })
}

pub fn set_notice(notice: Option<AppError>) {
    *NOTICE.lock().unwrap_or_else(|e| e.into_inner()) = notice;
}

/// Why the launcher opened instead of the game, once.
#[tauri::command]
#[specta::specta]
pub fn take_quickstart_notice() -> AppResult<()> {
    match NOTICE.lock().unwrap_or_else(|e| e.into_inner()).take() {
        Some(e) => Err(e),
        None => Ok(()),
    }
}
