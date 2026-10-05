//! The Wine/Proton front-end a Linux launch runs through: finding the ones
//! installed, and deciding whether a configured one is really there.

use crate::platform;
use serde::Serialize;
use std::path::Path;

#[derive(Serialize, specta::Type)]
pub struct WrapperOption {
    pub command: String,
    pub label: String,
}

/// The ONLY shape any of the three lookups below may use: `prog` rides in as
/// `$1` rather than spliced into the script text, so nothing user-controlled
/// reaches the shell parser. A path with spaces survives; a name carrying `;`,
/// a backtick or `$(...)` is looked up rather than executed. `"_"` fills `$0`.
///
/// There is deliberately no `>/dev/null` in the script: the yes/no callers null
/// their stdio on the `Command` instead, which lets `detect_wrappers` reuse the
/// same string and read the resolved path off stdout. Anything that needs to
/// look up a program goes through this — a second, hand-rolled `command -v` is
/// how the injection this replaced got in.
const LOOKUP: &str = r#"command -v "$1""#;

/// `sh -c LOOKUP` for `prog`, relayed to the host when the launcher itself
/// lives in a container (the game, and its wrapper, run on the host).
fn lookup_cmd(prog: &str) -> std::process::Command {
    let mut cmd = if platform::in_container() {
        let mut c = std::process::Command::new("distrobox-host-exec");
        c.arg("sh");
        c
    } else {
        std::process::Command::new("sh")
    };
    cmd.args(["-c", LOOKUP, "_", prog]);
    cmd
}

/// Run a command (on the host when the launcher lives in a container) and
/// return its stdout on success.
fn host_cmd_output(args: &[&str]) -> Option<String> {
    let mut argv: Vec<&str> = Vec::new();
    if platform::in_container() {
        argv.push("distrobox-host-exec");
    }
    argv.extend(args);
    let out = std::process::Command::new(argv[0])
        .args(&argv[1..])
        .output()
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Find the Wine-like wrappers actually present on this system, so the
/// Settings field can offer a pick list instead of a guess-the-name input.
/// Checks PATH, then the usual bin dirs directly (an AppImage started from
/// the desktop can see a thin PATH), then Flatpak.
#[tauri::command]
#[specta::specta]
pub fn detect_wrappers() -> Vec<WrapperOption> {
    let mut found: Vec<WrapperOption> = Vec::new();
    if cfg!(windows) {
        return found;
    }
    let mut push = |command: String, label: String| {
        if !found.iter().any(|w| w.command == command) {
            found.push(WrapperOption { command, label });
        }
    };

    let home_bin = std::env::var("HOME").map(|h| format!("{h}/.local/bin"));
    for cand in ["umu-run", "wine", "wine64", "wine-stable"] {
        if let Some(path) = host_cmd_output(&["sh", "-c", LOOKUP, "_", cand]) {
            let path = path.trim().to_string();
            if !path.is_empty() {
                push(cand.into(), format!("{cand} ({path})"));
                continue;
            }
        }
        let mut dirs = vec!["/usr/bin".to_string(), "/usr/local/bin".to_string()];
        if let Ok(hb) = &home_bin {
            dirs.push(hb.clone());
        }
        for dir in dirs {
            let p = format!("{dir}/{cand}");
            if Path::new(&p).exists() {
                push(p.clone(), format!("{cand} ({p})"));
                break;
            }
        }
    }

    if let Some(list) = host_cmd_output(&["flatpak", "list", "--app", "--columns=application"]) {
        if list.lines().any(|l| l.trim() == "org.winehq.Wine") {
            push("flatpak run org.winehq.Wine".into(), "Wine (Flatpak)".into());
        }
    }
    found
}

/// Split the configured wrapper into argv. An absolute path that exists on
/// disk is the whole program, spaces and all — never a word list, or a wine
/// under "/opt/my wine/bin" gets torn in half. Everything else keeps the word
/// split, so multi-word wrappers ("flatpak run org.winehq.Wine") still work.
pub(super) fn parse_wrapper(command: &str) -> Vec<String> {
    let trimmed = command.trim();
    if trimmed.starts_with('/') && Path::new(trimmed).is_file() {
        return vec![trimmed.to_string()];
    }
    trimmed.split_whitespace().map(str::to_string).collect()
}

/// A plain Wine front-end: no Proton, so no DXVK. Spellbreak then renders through Wine's own Direct3D
/// (wined3d), which draws characters flat white and runs at a fraction of the frame rate. The launcher
/// only runs the game through Proton (umu-run); this is how it recognises a setting to move off of.
/// Anything mentioning umu or Proton is not plain Wine, and neither is an unknown custom command.
pub(crate) fn is_plain_wine(command: &str) -> bool {
    let c = command.trim();
    let lower = c.to_ascii_lowercase();
    if lower.contains("umu") || lower.contains("proton") {
        return false;
    }
    if c.contains("org.winehq.Wine") {
        return true;
    }
    let first = parse_wrapper(c).into_iter().next().unwrap_or_default();
    let name = Path::new(&first).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    matches!(name.as_str(), "wine" | "wine64" | "wine-stable" | "wine-staging" | "wine-development")
}

/// `steam steam://rungameid/<id>`: the game's own shortcut in Steam (see
/// `steam/link.rs`). Steam starts the game on the Proton that shortcut is
/// set to, so it runs alone — none of what a Wine launch brings (prefix,
/// overrides, the exe) goes along.
pub(super) fn steam_run(command: &str) -> Option<Vec<String>> {
    let argv = parse_wrapper(command);
    match argv.as_slice() {
        [prog, url]
            if Path::new(prog).file_name().is_some_and(|n| n == "steam")
                && url.starts_with("steam://rungameid/") =>
        {
            Some(argv)
        }
        _ => None,
    }
}

/// Check the launch wrapper exists where the game will actually run
/// (on the host when the launcher itself lives in a container).
pub(super) fn wrapper_available(prog: &str) -> bool {
    lookup_cmd(prog)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|st| st.success())
        .unwrap_or(true) // if the check itself fails, don't block the launch
}

/// Strict "is this wrapper/command actually installed" check, used by the
/// runtime setup to decide whether anything needs provisioning. Unlike
/// `wrapper_available` (which errs toward letting a launch proceed), this
/// returns false when the check can't be run. Absolute paths are tested
/// directly; bare names go through `command -v` on the host (the game runs on
/// the host even when the launcher lives in a container).
pub(crate) fn command_present(prog: &str) -> bool {
    let prog = prog.trim();
    if prog.is_empty() {
        return false;
    }
    if Path::new(prog).is_absolute() {
        return Path::new(prog).exists();
    }
    lookup_cmd(prog)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|st| st.success())
        .unwrap_or(false)
}

#[cfg(test)]
#[path = "__tests/wrapper.rs"]
mod tests;
