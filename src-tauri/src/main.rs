#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod game;
mod mods;
mod remote;
mod settings;

fn main() {
    // The webkit bundled into the AppImage trips webkit's DMA-BUF renderer
    // bug on many GPU/driver combos (blank white window). Native Linux
    // builds use the system webkit and don't need this.
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPIMAGE").is_some() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Elemental Fracture launcher");
}
