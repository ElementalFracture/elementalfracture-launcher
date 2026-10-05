//! The Proton builds a Proton-based wrapper (umu-run) can run the game on:
//! finding the ones installed, and settling which one a launch gets.

use crate::steam::client::Steam;
use crate::steam::vdf;
use serde::Serialize;
use std::cmp::Ordering;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize, specta::Type, Clone, Debug, PartialEq)]
pub struct ProtonOption {
    /// The folder holding the `proton` script, as PROTONPATH takes it.
    pub path: String,
    pub label: String,
    /// The name Steam knows the build by, which its per-game compatibility
    /// setting stores: the tool's key in `compatibilitytool.vdf`, or for
    /// Valve's own builds the name Steam gives them ("proton_10"). None when
    /// it can't be told, which keeps the build off Steam's picker.
    pub tool: Option<String>,
}

/// The folders distributions package Proton builds into (proton-cachyos,
/// for one). Steam reads them too.
const SYSTEM_ROOTS: [&str; 2] = [
    "/usr/share/steam/compatibilitytools.d",
    "/usr/local/share/steam/compatibilitytools.d",
];

/// Where the native Steam client looks: its own tools folder, every
/// library's `steamapps/common` (where Valve's builds install), and the
/// system folders.
fn steam_roots(steam: &Steam) -> Vec<PathBuf> {
    let mut roots = vec![steam.compat_tools_dir()];
    roots.extend(steam.libraries().into_iter().map(|l| l.join("steamapps").join("common")));
    roots.extend(SYSTEM_ROOTS.iter().map(PathBuf::from));
    roots
}

/// Where Proton builds live: everywhere Steam looks, and the usual Steam
/// roots even when the client itself isn't found, Flatpak Steam's included.
fn roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Steam::locate().map(|s| steam_roots(&s)).unwrap_or_default();
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        for steam in [
            ".steam/steam",
            ".steam/root",
            ".local/share/Steam",
            ".var/app/com.valvesoftware.Steam/data/Steam",
        ] {
            roots.push(home.join(steam).join("compatibilitytools.d"));
            roots.push(home.join(steam).join("steamapps").join("common"));
        }
    }
    roots.extend(SYSTEM_ROOTS.iter().map(PathBuf::from));
    roots
}

/// A compatibility tool's key and display name, from its
/// `compatibilitytool.vdf`.
fn tool_vdf(dir: &Path) -> Option<(String, Option<String>)> {
    let text = fs::read_to_string(dir.join("compatibilitytool.vdf")).ok()?;
    let tree = vdf::parse_text(&text).ok()?;
    tree.path(&["compatibilitytools", "compat_tools"])?
        .0
        .iter()
        .find_map(|(key, v)| match v {
            vdf::Value::Obj(tool) => Some((
                key.clone(),
                tool.str("display_name").filter(|n| !n.trim().is_empty()).map(str::to_string),
            )),
            _ => None,
        })
}

/// The name Steam gives Valve's own builds, which carry no
/// `compatibilitytool.vdf`: "Proton - Experimental" is proton_experimental,
/// and a version drops its dot and a trailing ".0" ("Proton 10.0" is
/// proton_10, "Proton 6.3" proton_63, "Proton 9.0 (Beta)" proton_9).
pub(crate) fn valve_tool_name(dir_name: &str) -> Option<String> {
    let rest = dir_name.strip_prefix("Proton")?.trim();
    match rest {
        "- Experimental" => return Some("proton_experimental".into()),
        "Hotfix" => return Some("proton_hotfix".into()),
        _ => {}
    }
    let version = rest.split_whitespace().next()?;
    let (major, minor) = version.split_once('.')?;
    let digits = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_digit());
    if !digits(major) || !digits(minor) {
        return None;
    }
    Some(if minor == "0" { format!("proton_{major}") } else { format!("proton_{major}{minor}") })
}

/// Version-aware order: "GE-Proton10-4" after "GE-Proton9-27", and case
/// ignored, so a plain string sort doesn't put the oldest build last.
fn natural_cmp(a: &str, b: &str) -> Ordering {
    fn chunks(s: &str) -> Vec<(bool, String)> {
        let mut out: Vec<(bool, String)> = Vec::new();
        for c in s.chars() {
            let digit = c.is_ascii_digit();
            match out.last_mut() {
                Some((d, chunk)) if *d == digit => chunk.push(c),
                _ => out.push((digit, c.to_string())),
            }
        }
        out
    }
    let (a, b) = (chunks(a), chunks(b));
    for ((da, ca), (db, cb)) in a.iter().zip(&b) {
        let ord = if *da && *db {
            let (ta, tb) = (ca.trim_start_matches('0'), cb.trim_start_matches('0'));
            ta.len().cmp(&tb.len()).then_with(|| ta.cmp(tb))
        } else {
            ca.to_lowercase().cmp(&cb.to_lowercase())
        };
        if ord != Ordering::Equal {
            return ord;
        }
    }
    a.len().cmp(&b.len())
}

/// Every Proton build under `roots`: a folder with a `proton` script in it,
/// which is also what keeps games in `steamapps/common` off the list. The
/// same folder reached twice (`~/.steam/steam` is a symlink to Steam's root)
/// is listed once. GE-Proton comes first, then the rest, newest first in
/// each — the order the automatic pick takes the head of.
pub(crate) fn scan(roots: &[PathBuf]) -> Vec<ProtonOption> {
    let mut seen: Vec<PathBuf> = Vec::new();
    let mut found: Vec<ProtonOption> = Vec::new();
    for root in roots {
        let Ok(entries) = fs::read_dir(root) else { continue };
        for entry in entries.flatten() {
            let dir = entry.path();
            if !dir.join("proton").is_file() {
                continue;
            }
            let real = fs::canonicalize(&dir).unwrap_or_else(|_| dir.clone());
            if seen.contains(&real) {
                continue;
            }
            seen.push(real);
            let folder = entry.file_name().to_string_lossy().into_owned();
            let (tool, label) = match tool_vdf(&dir) {
                Some((key, display)) => (Some(key), display.unwrap_or_else(|| folder.clone())),
                None => (valve_tool_name(&folder), folder),
            };
            found.push(ProtonOption { path: dir.to_string_lossy().into_owned(), label, tool });
        }
    }
    let ge = |o: &ProtonOption| o.label.starts_with("GE-Proton");
    found.sort_by(|a, b| ge(b).cmp(&ge(a)).then_with(|| natural_cmp(&b.label, &a.label)));
    // Two builds by the same name (native and Flatpak Steam both holding
    // GE-Proton10-4, say) are told apart by where they are.
    let labels: Vec<String> = found.iter().map(|o| o.label.clone()).collect();
    for o in &mut found {
        if labels.iter().filter(|l| **l == o.label).count() > 1 {
            o.label = format!("{} ({})", o.label, o.path);
        }
    }
    found
}

/// The Proton builds installed on this system, for the Settings picker.
#[tauri::command]
#[specta::specta]
pub fn detect_protons() -> Vec<ProtonOption> {
    if cfg!(windows) {
        return Vec::new();
    }
    scan(&roots())
}

/// The builds the native Steam client can force on a game, by the name its
/// compatibility setting takes.
pub fn steam_compat_tools(steam: &Steam) -> Vec<ProtonOption> {
    scan(&steam_roots(steam)).into_iter().filter(|o| o.tool.is_some()).collect()
}

/// The PROTONPATH a launch gets: the one picked in Settings while it is still
/// installed, otherwise the head of the detected list. A picked build that
/// has since been removed falls back rather than blocking the launch.
pub(super) fn resolve_proton(configured: &str) -> Option<String> {
    let configured = configured.trim();
    if !configured.is_empty() && Path::new(configured).join("proton").is_file() {
        return Some(configured.to_string());
    }
    detect_protons().into_iter().next().map(|o| o.path)
}

#[cfg(test)]
#[path = "__tests/proton.rs"]
mod tests;
