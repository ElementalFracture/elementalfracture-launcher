//! Steam: running under it, and wiring the launcher into it.
//!
//! `session` is what changes when Steam started us, `client` finds the Steam
//! install and reads its state, `vdf` reads and writes its config formats,
//! `link` is the Settings card's commands (link Spellbreak's Play, add a
//! shortcut), and `quickstart` starts the game straight from that Play.

pub(crate) mod client;
mod link;
mod quickstart;
mod session;
pub(crate) mod vdf;

// Re-exported wholesale rather than by name — see the note in download/mod.rs
// about the hidden items `#[tauri::command]` leaves next to each function.
pub use link::*;
pub use quickstart::*;
pub use session::*;
