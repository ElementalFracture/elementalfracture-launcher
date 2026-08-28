#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod game;
mod mods;
mod remote;
mod settings;

// Only used by the debug-only bindings export below, so it has to carry the
// same cfg or release builds warn about an unused import.
#[cfg(debug_assertions)]
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

/// Fully exit the launcher. Used on game start (the window's X only minimizes,
/// so this is the real quit path) and bypasses the close-to-minimize handler.
#[tauri::command]
#[specta::specta]
fn quit_launcher(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
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
        settings::pick_game_dir,
        settings::open_url,
        game::get_status,
        game::set_variant,
        game::launch_game,
        game::auto_find_game,
        game::detect_wrappers,
        download::download_game,
        download::update_patch,
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
        remote::apply_token,
        remote::login_email,
        remote::logout,
        remote::refresh_account,
        remote::friends_list,
        remote::friend_add,
        remote::friend_accept,
        remote::friend_remove,
    ]);

    // Regenerated on every debug run so the frontend's typed bindings never
    // drift from the actual Rust command signatures.
    #[cfg(debug_assertions)]
    builder
        .export(
            Typescript::default().header("// @ts-nocheck\n"),
            "../ui/generated/bindings.ts",
        )
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Opt-in (Settings → Launcher): when "minimize on close" is enabled, the X
        // minimizes to the taskbar instead of quitting. Off by default = normal close.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if settings::load(window.app_handle()).minimize_on_close {
                    api.prevent_close();
                    let _ = window.minimize();
                }
            }
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running Elemental Fracture launcher");
}
