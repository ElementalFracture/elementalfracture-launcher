//! Everything the launcher asks the portal and the players sidecar about.
//!
//! `live` is what the home view polls (who's online, what's on), `account`
//! owns sign-in and the role badges, `friends` the roster, and `news` the
//! patchnotes feed. They all share the one short-timeout client below: these
//! are things the UI waits on, so a slow endpoint must give up quickly rather
//! than hang a row.

mod account;
mod friends;
mod live;
mod news;

// Re-exported wholesale rather than by name — see the note in download/mod.rs
// about the hidden items `#[tauri::command]` leaves next to each function.
pub use account::*;
pub use friends::*;
pub use live::*;
pub use news::*;

use crate::error::AppResult;
use std::time::Duration;

pub(super) fn client() -> AppResult<reqwest::Client> {
    let c = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .user_agent(concat!("ef-launcher/", env!("CARGO_PKG_VERSION")))
        .build()?;
    Ok(c)
}
