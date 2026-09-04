//! The two hidden files in the game root that the in-game injector reads:
//! `.ef_auth` (who is signed in) and `.ef_mode` (which balance is mounted).
//! Both are rewritten fresh rather than trusted from a previous run.

use std::fs;
use std::path::Path;

/// Write (or clear) the hidden `.ef_auth` file the injector reads: line 0 the
/// token, line 1 the server. Marked Hidden on Windows (a dot prefix only
/// hides it on Linux).
pub(super) fn write_hidden_auth(root: &Path, token: &str, host: &str) {
    let path = root.join(".ef_auth");
    if token.is_empty() {
        let _ = fs::remove_file(&path);
        return;
    }
    if fs::write(&path, format!("{token}\n{host}\n")).is_err() {
        return;
    }
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

/// Write the hidden `.ef_mode` marker the injector reads (one line: `ef` or `classic`) so the
/// in-game controller can re-skin + swap its Loadout data to match the active balance pak.
/// Marked Hidden on Windows, like `.ef_auth`.
pub(super) fn write_hidden_mode(root: &Path, mode: &str) {
    let path = root.join(".ef_mode");
    if fs::write(&path, format!("{mode}\n")).is_err() {
        return;
    }
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
