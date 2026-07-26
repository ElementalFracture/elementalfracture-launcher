#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod game;
mod mods;
mod remote;
mod settings;

use specta_typescript::Typescript;
use tauri_specta::{collect_commands, Builder};

fn main() {
    // The webkit bundled into the AppImage trips webkit's DMA-BUF renderer
    // bug on many GPU/driver combos (blank white window). Native Linux
    // builds use the system webkit and don't need this.
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPIMAGE").is_some() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
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
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running Elemental Fracture launcher");
}
