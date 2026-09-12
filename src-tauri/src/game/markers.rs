//! The hidden `.ef_mode` marker in the game root that the in-game injector
//! reads (which balance is mounted). Rewritten fresh on every launch rather
//! than trusted from a previous run.
//!
//! There used to be a second marker, `.ef_auth`, carrying the session key and
//! server host. The game no longer reads it, so the launcher no longer writes
//! it — and `launch` deletes any copy an older build left behind, since it
//! held the key in plaintext next to the game.

use std::fs;
use std::path::Path;

/// Write the hidden `.ef_mode` marker the injector reads (one line: `ef` or `classic`) so the
/// in-game controller can re-skin + swap its Loadout data to match the active balance pak.
/// Marked Hidden on Windows (a dot prefix only hides it on Linux).
pub(super) fn write_hidden_mode(root: &Path, mode: &str) {
    let path = root.join(".ef_mode");
    let Ok(()) = fs::write(&path, format!("{mode}\n")) else {
        return;
    };
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
        extern "system" {
            fn SetFileAttributesW(name: *const u16, attrs: u32) -> i32;
        }
        let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
        unsafe { SetFileAttributesW(wide.as_ptr(), FILE_ATTRIBUTE_HIDDEN) };
    }
}

#[cfg(test)]
#[path = "__tests/markers.rs"]
mod tests;
