//! The game as it sits on disk: where it is, which balance pak is mounted,
//! what it takes to start it.
//!
//! `install` locates a copy and reads its version, `variant` owns the pak
//! swapping that switches between Production, Vanilla and Playtest, `wrapper`
//! finds the Wine/Proton front-end a Linux launch goes through, `proton` the
//! Proton builds that front-end can run on, and `launch` assembles the actual
//! command. `markers` writes the two hidden files the
//! in-game injector reads.

mod folder;
mod install;
mod launch;
mod markers;
mod proton;
mod variant;
mod wrapper;

// Re-exported wholesale rather than by name — see the note in download/mod.rs
// about the hidden items `#[tauri::command]` leaves next to each function.
pub use folder::*;
pub use install::*;
pub use launch::*;
pub use proton::*;
pub use variant::*;
pub use wrapper::*;

use crate::settings;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize, specta::Type)]
pub struct GameStatus {
    pub game_path: String,
    pub valid: bool,
    pub exe_present: bool,
    /// "ef" (Production) | "classic" (Vanilla) | "playtest" | "unknown"
    pub variant: String,
    /// Whether the Playtest pak is present (active or parked), so the UI can
    /// offer "switch to it" rather than "download it first".
    pub test_installed: bool,
    pub local_version: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn get_status(app: tauri::AppHandle) -> GameStatus {
    let s = settings::load(&app);
    let root = PathBuf::from(&s.game_path);
    GameStatus {
        valid: !s.game_path.is_empty() && root.join("g3").is_dir(),
        exe_present: find_exe(&root).is_some(),
        variant: detect_variant(&root),
        test_installed: test_build_installed(&root),
        local_version: read_local_version(&root),
        game_path: s.game_path,
    }
}
