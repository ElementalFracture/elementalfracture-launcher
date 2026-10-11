#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod error;
mod game;
mod mods;
mod platform;
mod remote;
mod settings;
mod steam;

// Only used by the debug-only bindings export below, so it has to carry the
// same cfg or release builds warn about an unused import.
#[cfg(debug_assertions)]
use specta_typescript::{BigIntExportBehavior, Typescript};
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

/// Fully exit the launcher. Used on game start (the window's X only minimizes,
/// so this is the real quit path) and bypasses the close-to-minimize handler.
#[tauri::command]
#[specta::specta]
fn quit_launcher(app: tauri::AppHandle) {
    // Under Steam the session (and its controller remap) lives as long as this
    // process, so the quit waits for the game.
    if !steam::defer_quit(&app) {
        app.exit(0);
    }
}

/// A startup failure in a windowed build has no console to land in, so say it
/// in a dialog rather than vanish.
fn fatal(message: &str) -> ! {
    eprintln!("{message}");
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
        let wide = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
        let (text, caption) = (wide(message), wide("Elemental Fracture"));
        unsafe { MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), MB_OK | MB_ICONERROR) };
    }
    std::process::exit(1);
}

/// The window is declared in tauri.conf.json with `create: false` and built
/// here, where the Steam session can adjust the webview and quickstart can
/// skip it.
fn open_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    let config = &app.config().app.windows[0];
    let mut window = tauri::WebviewWindowBuilder::from_config(app, config)?;
    if let Some(args) = steam::browser_args() {
        window = window.additional_browser_args(args);
    }
    window.build()?;
    Ok(())
}

fn main() {
    steam::init();

    // The webkit bundled into the AppImage trips webkit's DMA-BUF renderer
    // bug on many GPU/driver combos (blank white window). Native Linux
    // builds use the system webkit and don't need this.
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPIMAGE").is_some() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        quit_launcher,
        settings::get_settings,
        settings::save_settings,
        settings::reset_settings,
        platform::pick_game_dir,
        platform::launcher_elevated,
        game::check_game_folder,
        game::suggested_install_dir,
        platform::open_url,
        game::get_status,
        game::set_variant,
        game::launch_game,
        game::auto_find_game,
        game::detect_wrappers,
        game::detect_protons,
        download::download_game,
        download::ensure_runtime,
        download::update_patch,
        download::verify_game_files,
        download::install_playtest_build,
        download::get_versions,
        download::get_launcher_update,
        download::update_launcher,
        download::get_remote_config,
        mods::verify_install,
        mods::install_mods,
        remote::get_players,
        remote::get_events,
        remote::get_news,
        remote::login_email,
        remote::logout,
        remote::refresh_account,
        remote::friends_list,
        remote::friend_add,
        remote::friend_accept,
        remote::friend_remove,
        steam::steam_status,
        steam::steam_set_linked,
        steam::steam_set_shortcut,
        steam::steam_game_id,
        steam::steam_compat_tool,
        steam::steam_set_compat_tool,
        steam::steam_compat_tools,
        steam::steam_shutdown,
        steam::take_quickstart_notice,
    ]);

    // Regenerated on every debug run so the frontend's typed bindings never
    // drift from the actual Rust command signatures. u64s cross IPC as plain
    // JSON numbers, so `number` is what JS really gets; specta's default is to
    // refuse the export (and leave an empty bindings.ts) on any 64-bit field.
    #[cfg(debug_assertions)]
    builder
        .export(
            Typescript::default()
                .header("// @ts-nocheck\n")
                .bigint(BigIntExportBehavior::Number),
            "../ui/generated/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Opt-in (Settings → Launcher): when "minimize on close" is enabled, the X
        // minimizes to the taskbar instead of quitting. Off by default = normal close.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if steam::defer_quit(window.app_handle()) {
                    api.prevent_close();
                } else if settings::load(window.app_handle()).minimize_on_close {
                    api.prevent_close();
                    let _ = window.minimize();
                }
            }
        })
        .invoke_handler(builder.invoke_handler())
        .setup(|app| {
            let handle = app.handle().clone();
            // "Run as administrator" (Settings, or offered when the game folder can't be written to): start again
            // elevated, then stop this copy. A Steam start is left alone (the elevated copy wouldn't carry Steam's
            // environment), and so is a player who declines the UAC prompt: they get a normal launcher.
            #[cfg(windows)]
            if settings::load(&handle).run_as_admin && !platform::is_elevated() && !steam::wanted(&handle)
                && platform::relaunch_elevated()
            {
                std::process::exit(0);
            }
            steam::refresh_tool();
            if !steam::wanted(&handle) {
                return Ok(open_window(&handle)?);
            }
            // Quickstart: no window unless the game can't be started from here.
            tauri::async_runtime::spawn(async move {
                if let Err(notice) = steam::run(&handle).await {
                    steam::set_notice(notice);
                    if let Err(e) = open_window(&handle) {
                        fatal(&format!("Elemental Fracture failed to start:\n\n{e}"));
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| fatal(&format!("Elemental Fracture failed to start:\n\n{e}")));
}
