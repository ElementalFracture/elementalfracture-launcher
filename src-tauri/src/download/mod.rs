//! Everything the launcher pulls from the CDN.
//!
//! Split by concern rather than by flow: the bottom two modules (`progress`,
//! `transfer`, `archive`) are the plumbing — bytes over the wire and bytes out
//! of an archive — and the rest are the four things built on it that the
//! frontend can actually call: installing/patching the game, reading the
//! remote config, provisioning a Linux game runtime, and replacing the
//! launcher itself.

mod archive;
mod config;
mod install;
mod progress;
mod runtime;
mod self_update;
mod transfer;

// Re-exported wholesale rather than by name: `#[tauri::command]` generates
// hidden items next to each function (`__cmd__*`, `__specta__fn__*`) that
// `collect_commands!` in main.rs resolves through the same path, and a
// by-name `pub use` leaves them behind.
pub use config::*;
pub use install::*;
pub use runtime::*;
pub use self_update::*;
