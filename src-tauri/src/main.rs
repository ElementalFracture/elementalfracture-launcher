#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod game;
mod mods;
mod remote;
mod settings;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            settings::get_settings,
            settings::save_settings,
            settings::pick_game_dir,
            settings::open_url,
            game::get_status,
            game::set_variant,
            game::launch_game,
            game::auto_find_game,
            download::download_game,
            download::update_patch,
            download::get_versions,
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
