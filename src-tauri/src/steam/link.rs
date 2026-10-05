//! Putting the launcher, or the game itself, into Steam.
//!
//! - **Linked**: for someone who owns Spellbreak on Steam. Pressing Play on
//!   Spellbreak opens this launcher, so the session is Spellbreak's own:
//!   its controller layouts, overlay and playtime. On Windows that's the
//!   app's launch options (`"<launcher>" %command%`). On Linux the launch
//!   options would run inside the Steam Linux Runtime container, where the
//!   AppImage can't start, so instead Spellbreak is pointed at a tiny
//!   compatibility tool that runs on the host and hands off to the launcher.
//!   The Elemental Fracture game files stay where they are either way; Steam's
//!   copy is only ever the thing Play is pressed on.
//! - **Shortcut**: a non-Steam game entry, with artwork. On Windows it
//!   starts the launcher. On Linux it is the game itself, set up the way the
//!   Linux guide has players do by hand: Spellbreak.exe, the mod loader's
//!   Wine override in its launch options, forced onto a Proton build. The
//!   launch wrapper's Steam option then has Play start it through Steam
//!   (`steam steam://rungameid/<id>`), for players whose game only runs well
//!   under Steam's own Proton setup.
//!
//! Steam keeps all of this in memory and writes it back when it exits, so
//! every change requires Steam to be closed, and each file is backed up
//! before its first write.

use super::client::Steam;
use super::vdf::{self, Bin, BinObj, Obj};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{game, platform, settings};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const SPELLBREAK_APPID: &str = "1399780";
const SHORTCUT_NAME: &str = "Elemental Fracture";
#[cfg(not(windows))]
const TOOL_NAME: &str = "ElementalFracture";

#[derive(Serialize, specta::Type, Default)]
pub struct SteamStatus {
    /// A native Steam client is installed.
    pub found: bool,
    pub running: bool,
    /// Steam has an account we can write per-user settings for.
    pub has_user: bool,
    /// Spellbreak is installed through Steam, so it can be linked.
    pub spellbreak_installed: bool,
    pub linked: bool,
    /// The shortcut is in Steam: the launcher's on Windows, the game's on
    /// Linux.
    pub shortcut: bool,
    /// The Steam folder these were read from, shown when no account turns up
    /// so a report says where the launcher looked.
    pub root: String,
}

/// What a link replaced, so unlinking puts it back.
#[derive(Serialize, Deserialize, Default)]
struct LinkState {
    previous_launch_options: Option<String>,
    previous_compat_tool: Option<String>,
}

fn state_path(app: &tauri::AppHandle) -> PathBuf {
    settings::config_dir(app).join("steam_link.json")
}

fn load_state(app: &tauri::AppHandle) -> LinkState {
    fs::read_to_string(state_path(app))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn store_state(app: &tauri::AppHandle, state: &LinkState) -> AppResult<()> {
    fs::write(state_path(app), serde_json::to_string_pretty(state)?)?;
    Ok(())
}

/// The file Steam should start: the .AppImage itself, not its mount.
fn launcher_path() -> AppResult<PathBuf> {
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
        return Ok(PathBuf::from(appimage));
    }
    Ok(std::env::current_exe()?)
}

fn same_path(a: &str, b: &Path) -> bool {
    let b = b.to_string_lossy();
    if cfg!(windows) {
        a.eq_ignore_ascii_case(&b)
    } else {
        a == b
    }
}

fn unreadable(file: &Path, detail: impl std::fmt::Display) -> AppError {
    AppError::new(ErrorCode::SteamConfigUnreadable)
        .with("file", file.display())
        .with("detail", detail)
}

fn read_text(file: &Path) -> AppResult<Obj> {
    match fs::read_to_string(file) {
        Ok(s) => vdf::parse_text(&s).map_err(|e| unreadable(file, e)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Obj::default()),
        Err(e) => Err(e.into()),
    }
}

/// Back up once (the first copy is the one worth keeping), then replace
/// atomically so a crash mid-write can't leave Steam a half file.
fn write_steam_file(file: &Path, bytes: &[u8]) -> AppResult<()> {
    let backup = PathBuf::from(format!("{}.ef-backup", file.display()));
    if file.exists() && !backup.exists() {
        fs::copy(file, &backup)?;
    }
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = PathBuf::from(format!("{}.ef-tmp", file.display()));
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, file)?;
    Ok(())
}

/// Steam, closed, with an account to write for.
fn writable_steam(need_user: bool) -> AppResult<(Steam, Option<String>)> {
    let steam = Steam::locate().ok_or_else(|| AppError::new(ErrorCode::SteamNotFound))?;
    if steam.running() {
        return Err(AppError::new(ErrorCode::SteamRunning));
    }
    let user = steam.active_user();
    if need_user && user.is_none() {
        return Err(AppError::new(ErrorCode::SteamNoUser));
    }
    Ok((steam, user))
}

/* ---- linking: Windows launch options ---- */

#[cfg(windows)]
const APP_PATH: [&str; 5] = ["UserLocalConfigStore", "Software", "Valve", "Steam", "apps"];

/// `"C:\...\Elemental Fracture.exe" %command%`
#[cfg_attr(not(windows), allow(dead_code))]
pub fn launch_options_for(launcher: &Path) -> String {
    format!("\"{}\" %command%", launcher.display())
}

/// Launch options that start a launcher with this file name, wherever it was
/// when it was linked. A moved install still counts, so relinking replaces
/// its own old entry rather than saving it as "what the user had".
#[cfg_attr(not(windows), allow(dead_code))]
pub fn launch_options_are_ours(options: &str, launcher: &Path) -> bool {
    let Some(rest) = options.strip_prefix('"') else { return false };
    let Some((path, tail)) = rest.split_once('"') else { return false };
    // Split by hand: the path was written on whichever OS linked it.
    let file_name = |p: &str| p.rsplit(['/', '\\']).next().unwrap_or("").to_string();
    tail.trim() == "%command%"
        && file_name(path).eq_ignore_ascii_case(&file_name(&launcher.to_string_lossy()))
}

#[cfg(windows)]
fn linked(steam: &Steam, user: Option<&str>) -> bool {
    let (Some(user), Ok(launcher)) = (user, launcher_path()) else { return false };
    read_text(&steam.user_config(user).join("localconfig.vdf"))
        .ok()
        .and_then(|t| t.path(&APP_PATH).and_then(|a| a.obj(SPELLBREAK_APPID)).cloned())
        .and_then(|app| app.str("LaunchOptions").map(|o| launch_options_are_ours(o, &launcher)))
        .unwrap_or(false)
}

#[cfg(windows)]
fn set_linked(app: &tauri::AppHandle, linked: bool) -> AppResult<()> {
    let (steam, user) = writable_steam(true)?;
    let file = steam.user_config(&user.unwrap()).join("localconfig.vdf");
    let launcher = launcher_path()?;
    let mut tree = read_text(&file)?;
    let entry = tree.path_mut(&APP_PATH).path_mut(&[SPELLBREAK_APPID]);
    let current = entry.str("LaunchOptions").unwrap_or("").to_string();
    let ours = launch_options_are_ours(&current, &launcher);
    let mut state = load_state(app);
    if linked {
        if !ours {
            state.previous_launch_options = Some(current);
            store_state(app, &state)?;
        }
        entry.set_str("LaunchOptions", &launch_options_for(&launcher));
    } else if ours {
        entry.set_str("LaunchOptions", state.previous_launch_options.as_deref().unwrap_or(""));
    } else {
        return Ok(());
    }
    write_steam_file(&file, vdf::write_text(&tree).as_bytes())
}

/* ---- linking: the Linux compatibility tool ---- */

#[cfg(not(windows))]
const MAPPING_PATH: [&str; 5] = ["InstallConfigStore", "Software", "Valve", "Steam", "CompatToolMapping"];

/// The hand-off script. Steam runs it as `<script> <verb> <command...>`.
#[cfg_attr(windows, allow(dead_code))]
pub fn tool_script(launcher: &Path) -> String {
    let quoted = format!("'{}'", launcher.to_string_lossy().replace('\'', r"'\''"));
    format!(
        r#"#!/bin/sh
# Elemental Fracture: Steam's Play on Spellbreak opens the launcher.
# Written by the launcher, and rewritten each time it starts.
verb="$1"
[ "$#" -gt 0 ] && shift
case "$verb" in
    waitforexitandrun|run) ;;
    *) exit 0 ;;
esac
# Install scripts (DirectX and VC++ redistributables) run through here too.
# The launcher's own runtime brings what the game needs, so they're skipped.
case "$*" in
    *Spellbreak.exe*|*g3-Win64*) ;;
    *) exit 0 ;;
esac
# Steam's library paths are for its own runtime; the launcher wants the system's.
[ -n "${{SYSTEM_LD_LIBRARY_PATH+x}}" ] && export LD_LIBRARY_PATH="$SYSTEM_LD_LIBRARY_PATH"
[ -n "${{SYSTEM_PATH+x}}" ] && export PATH="$SYSTEM_PATH"
exec {quoted}
"#
    )
}

#[cfg(not(windows))]
fn tool_dir(steam: &Steam) -> PathBuf {
    steam.compat_tools_dir().join(TOOL_NAME)
}

/// Write the tool's files. No Steam restart needed for the script itself,
/// which is why the launcher refreshes it on every start.
#[cfg(not(windows))]
fn write_tool(dir: &Path, launcher: &Path) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::create_dir_all(dir)?;
    fs::write(
        dir.join("compatibilitytool.vdf"),
        format!(
            "\"compatibilitytools\"\n{{\n\t\"compat_tools\"\n\t{{\n\t\t\"{TOOL_NAME}\"\n\t\t{{\n\t\t\t\"install_path\"\t\t\".\"\n\t\t\t\"display_name\"\t\t\"Elemental Fracture\"\n\t\t\t\"from_oslist\"\t\t\"windows\"\n\t\t\t\"to_oslist\"\t\t\"linux\"\n\t\t}}\n\t}}\n}}\n"
        ),
    )?;
    // No require_tool_appid: that is what keeps it out of the runtime container.
    fs::write(
        dir.join("toolmanifest.vdf"),
        "\"manifest\"\n{\n\t\"version\"\t\t\"2\"\n\t\"commandline\"\t\t\"/ef-launch %verb%\"\n}\n",
    )?;
    let script = dir.join("ef-launch");
    fs::write(&script, tool_script(launcher))?;
    fs::set_permissions(&script, fs::Permissions::from_mode(0o755))?;
    Ok(())
}

#[cfg(not(windows))]
fn linked(steam: &Steam, _user: Option<&str>) -> bool {
    tool_dir(steam).join("toolmanifest.vdf").is_file()
        && read_text(&steam.config_vdf())
            .ok()
            .and_then(|t| t.path(&MAPPING_PATH).and_then(|m| m.obj(SPELLBREAK_APPID)).cloned())
            .is_some_and(|m| m.str("name") == Some(TOOL_NAME))
}

#[cfg(not(windows))]
fn set_linked(app: &tauri::AppHandle, linked: bool) -> AppResult<()> {
    let (steam, _) = writable_steam(false)?;
    let file = steam.config_vdf();
    let mut tree = read_text(&file)?;
    let mapping = tree.path_mut(&MAPPING_PATH);
    let current = mapping
        .obj(SPELLBREAK_APPID)
        .and_then(|m| m.str("name"))
        .unwrap_or("")
        .to_string();
    let mut state = load_state(app);
    if linked {
        write_tool(&tool_dir(&steam), &launcher_path()?)?;
        if current != TOOL_NAME {
            state.previous_compat_tool = Some(current);
            store_state(app, &state)?;
        }
        let entry = mapping.path_mut(&[SPELLBREAK_APPID]);
        entry.set_str("name", TOOL_NAME);
        entry.set_str("config", "");
        entry.set_str("priority", "250");
    } else {
        if current == TOOL_NAME {
            match state.previous_compat_tool.as_deref().filter(|p| !p.is_empty()) {
                Some(previous) => mapping.path_mut(&[SPELLBREAK_APPID]).set_str("name", previous),
                None => {
                    mapping.remove(SPELLBREAK_APPID);
                }
            }
        }
        let _ = fs::remove_dir_all(tool_dir(&steam));
    }
    write_steam_file(&file, vdf::write_text(&tree).as_bytes())
}

/// Keep a linked tool pointing at wherever this launcher now lives.
pub fn refresh_tool() {
    #[cfg(not(windows))]
    if let (Some(steam), Ok(launcher)) = (Steam::locate(), launcher_path()) {
        let dir = tool_dir(&steam);
        if dir.join("toolmanifest.vdf").is_file() {
            let _ = write_tool(&dir, &launcher);
        }
    }
}

/* ---- the non-Steam shortcut ---- */

/// Steam's id for a shortcut: CRC-32 of exe + name with the top bit set.
/// Artwork files in `grid/` are named after it.
pub fn shortcut_appid(exe: &str, name: &str) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for byte in exe.bytes().chain(name.bytes()) {
        crc ^= byte as u32;
        for _ in 0..8 {
            crc = if crc & 1 != 0 { (crc >> 1) ^ 0xEDB8_8320 } else { crc >> 1 };
        }
    }
    !crc | 0x8000_0000
}

fn unquote(s: &str) -> &str {
    s.trim().trim_matches('"')
}

/// Shortcuts that start this launcher. Matched on the executable only: an
/// entry the player made by hand under the same name for something else is
/// theirs to keep.
pub fn shortcut_is_ours(entry: &BinObj, launcher: &Path) -> bool {
    entry.str("Exe").is_some_and(|exe| same_path(unquote(exe), launcher))
}

fn shortcuts_file(steam: &Steam, user: &str) -> PathBuf {
    steam.user_config(user).join("shortcuts.vdf")
}

fn read_shortcuts(file: &Path) -> AppResult<BinObj> {
    match fs::read(file) {
        Ok(bytes) if !bytes.is_empty() => vdf::parse_binary(&bytes).map_err(|e| unreadable(file, e)),
        Ok(_) => Ok(BinObj::default()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(BinObj::default()),
        Err(e) => Err(e.into()),
    }
}

fn entries(tree: &mut BinObj) -> &mut BinObj {
    if tree.obj_mut("shortcuts").is_none() {
        tree.set("shortcuts", Bin::Obj(BinObj::default()));
    }
    tree.obj_mut("shortcuts").unwrap()
}

fn shortcut_present(steam: &Steam, user: Option<&str>) -> bool {
    let (Some(user), Ok(launcher)) = (user, launcher_path()) else { return false };
    let Ok(mut tree) = read_shortcuts(&shortcuts_file(steam, user)) else { return false };
    entries(&mut tree).0.iter().any(|(_, v)| matches!(v, Bin::Obj(e) if shortcut_is_ours(e, &launcher)))
}

const ART: [(&str, &[u8]); 4] = [
    ("p.jpg", include_bytes!("../../assets/steam/portrait.jpg")),
    (".jpg", include_bytes!("../../assets/steam/wide.jpg")),
    ("_hero.jpg", include_bytes!("../../assets/steam/hero.jpg")),
    ("_logo.png", include_bytes!("../../assets/steam/logo.png")),
];

/// Add or update the entry in place (an existing entry keeps its id, and with
/// it any controller layout the player already made), or remove it.
pub fn apply_shortcut(tree: &mut BinObj, launcher: &Path, icon: &str, add: bool) -> Option<u32> {
    let list = entries(tree);
    let exe = format!("\"{}\"", launcher.display());
    let start_dir = format!("\"{}\"", launcher.parent().unwrap_or(Path::new("")).display());
    if !add {
        list.0.retain(|(_, v)| !matches!(v, Bin::Obj(e) if shortcut_is_ours(e, launcher)));
        // Steam expects the keys to count up from 0.
        for (i, (k, _)) in list.0.iter_mut().enumerate() {
            *k = i.to_string();
        }
        return None;
    }
    let existing = list
        .0
        .iter()
        .position(|(_, v)| matches!(v, Bin::Obj(e) if shortcut_is_ours(e, launcher)));
    let index = existing.unwrap_or_else(|| {
        let mut fresh = BinObj::default();
        fresh.set("appid", Bin::Int(shortcut_appid(&exe, SHORTCUT_NAME) as i32));
        list.0.push((list.0.len().to_string(), Bin::Obj(fresh)));
        list.0.len() - 1
    });
    let Bin::Obj(entry) = &mut list.0[index].1 else { unreachable!() };
    let appid = entry.int("appid").unwrap_or(shortcut_appid(&exe, SHORTCUT_NAME) as i32) as u32;
    entry.set("AppName", Bin::Str(SHORTCUT_NAME.into()));
    entry.set("Exe", Bin::Str(exe));
    entry.set("StartDir", Bin::Str(start_dir));
    entry.set("icon", Bin::Str(icon.into()));
    for (key, default) in [("AllowDesktopConfig", 1), ("AllowOverlay", 1)] {
        if entry.get(key).is_none() {
            entry.set(key, Bin::Int(default));
        }
    }
    if entry.get("tags").is_none() {
        entry.set("tags", Bin::Obj(BinObj::default()));
    }
    Some(appid)
}

fn set_shortcut(app: &tauri::AppHandle, add: bool) -> AppResult<()> {
    let (steam, user) = writable_steam(true)?;
    let user = user.unwrap();
    let file = shortcuts_file(&steam, &user);
    let launcher = launcher_path()?;
    let mut tree = read_shortcuts(&file)?;

    // Windows reads the icon out of the exe; elsewhere it needs an image file.
    let icon = if cfg!(windows) {
        launcher.display().to_string()
    } else {
        let path = settings::config_dir(app).join("steam-icon.png");
        fs::write(&path, include_bytes!("../../assets/steam/icon.png"))?;
        path.display().to_string()
    };

    let grid = steam.user_config(&user).join("grid");
    if !add {
        let ours: Vec<u32> = entries(&mut tree)
            .0
            .iter()
            .filter_map(|(_, v)| match v {
                Bin::Obj(e) if shortcut_is_ours(e, &launcher) => e.int("appid").map(|i| i as u32),
                _ => None,
            })
            .collect();
        for id in ours {
            for (suffix, _) in ART {
                let _ = fs::remove_file(grid.join(format!("{id}{suffix}")));
            }
        }
    }
    let appid = apply_shortcut(&mut tree, &launcher, &icon, add);
    write_steam_file(&file, &vdf::write_binary(&tree))?;
    if let Some(id) = appid {
        fs::create_dir_all(&grid)?;
        for (suffix, bytes) in ART {
            let path = grid.join(format!("{id}{suffix}"));
            // Artwork the player picked themselves wins.
            if !path.exists() {
                fs::write(path, bytes)?;
            }
        }
    }
    Ok(())
}

/* ---- the game itself as a shortcut, on Proton ---- */

#[cfg_attr(windows, allow(dead_code))]
const GAME_SHORTCUT_NAME: &str = "Spellbreak";
/// The Wine override that loads the EF mod loader, which Steam can't be
/// told any other way.
#[cfg_attr(windows, allow(dead_code))]
const GAME_LAUNCH_OPTIONS: &str = r#"WINEDLLOVERRIDES="xinput1_3=n,b" %command%"#;

/// The exe Steam runs: the top-level Spellbreak.exe players have been
/// picking by hand, else the one the launcher itself runs.
#[cfg_attr(windows, allow(dead_code))]
pub fn steam_game_exe(root: &Path) -> Option<PathBuf> {
    let found = game::find_exe(root)?;
    let shim = root.join("Spellbreak.exe");
    Some(if shim.is_file() { shim } else { found })
}

/// Shortcuts that start this game folder's exe, whoever made them: one a
/// player set up by hand is adopted rather than doubled.
pub fn game_shortcut_is_ours(entry: &BinObj, root: &Path) -> bool {
    entry.str("Exe").is_some_and(|exe| {
        let exe = Path::new(unquote(exe));
        let name = exe.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        exe.starts_with(root) && game::WIN64_EXES.iter().any(|w| w.eq_ignore_ascii_case(&name))
    })
}

/// Steam's game id for a shortcut, the one `steam://rungameid/` takes and
/// its "Add desktop shortcut" writes: the shortcut id in the top half.
#[cfg_attr(windows, allow(dead_code))]
pub fn rungameid(appid: u32) -> u64 {
    (u64::from(appid) << 32) | 0x0200_0000
}

/// Add or update the entry (an adopted one keeps its id and name, and its
/// launch options when they already carry the override), or remove it.
#[cfg_attr(windows, allow(dead_code))]
pub fn apply_game_shortcut(tree: &mut BinObj, root: &Path, exe: &Path, add: bool) -> Option<u32> {
    let list = entries(tree);
    if !add {
        list.0.retain(|(_, v)| !matches!(v, Bin::Obj(e) if game_shortcut_is_ours(e, root)));
        for (i, (k, _)) in list.0.iter_mut().enumerate() {
            *k = i.to_string();
        }
        return None;
    }
    let exe_field = format!("\"{}\"", exe.display());
    let existing = list
        .0
        .iter()
        .position(|(_, v)| matches!(v, Bin::Obj(e) if game_shortcut_is_ours(e, root)));
    let index = existing.unwrap_or_else(|| {
        let mut fresh = BinObj::default();
        fresh.set("appid", Bin::Int(shortcut_appid(&exe_field, GAME_SHORTCUT_NAME) as i32));
        fresh.set("AppName", Bin::Str(GAME_SHORTCUT_NAME.into()));
        list.0.push((list.0.len().to_string(), Bin::Obj(fresh)));
        list.0.len() - 1
    });
    let Bin::Obj(entry) = &mut list.0[index].1 else { unreachable!() };
    let appid = entry.int("appid").unwrap_or(shortcut_appid(&exe_field, GAME_SHORTCUT_NAME) as i32) as u32;
    entry.set("Exe", Bin::Str(exe_field));
    entry.set(
        "StartDir",
        Bin::Str(format!("\"{}\"", exe.parent().unwrap_or(Path::new("")).display())),
    );
    if !entry.str("LaunchOptions").is_some_and(|o| o.contains("xinput1_3=n,b")) {
        entry.set("LaunchOptions", Bin::Str(GAME_LAUNCH_OPTIONS.into()));
    }
    for (key, default) in [("AllowDesktopConfig", 1), ("AllowOverlay", 1)] {
        if entry.get(key).is_none() {
            entry.set(key, Bin::Int(default));
        }
    }
    if entry.get("tags").is_none() {
        entry.set("tags", Bin::Obj(BinObj::default()));
    }
    Some(appid)
}

#[cfg_attr(windows, allow(dead_code))]
fn game_shortcut_ids(tree: &mut BinObj, root: &Path) -> Vec<u32> {
    entries(tree)
        .0
        .iter()
        .filter_map(|(_, v)| match v {
            Bin::Obj(e) if game_shortcut_is_ours(e, root) => e.int("appid").map(|i| i as u32),
            _ => None,
        })
        .collect()
}

/// The game's shortcut id.
#[cfg(not(windows))]
fn game_shortcut_id(steam: &Steam, user: Option<&str>, root: &str) -> Option<u32> {
    if root.is_empty() {
        return None;
    }
    let mut tree = read_shortcuts(&shortcuts_file(steam, user?)).ok()?;
    game_shortcut_ids(&mut tree, Path::new(root)).first().copied()
}

#[cfg(windows)]
fn game_shortcut_id(_: &Steam, _: Option<&str>, _: &str) -> Option<u32> {
    None
}

/// The key Steam files a game's compatibility setting under: a shortcut's
/// id, which is the top half of its game id, or a Steam app's own id.
pub fn compat_key(game_id: &str) -> Option<String> {
    let id: u64 = game_id.trim().parse().ok()?;
    Some(if id >> 32 != 0 { (id >> 32).to_string() } else { id.to_string() })
}

/// The tool Steam forces on the game filed under `key`.
#[cfg_attr(windows, allow(dead_code))]
fn forced_tool(config: &Obj, key: &str) -> Option<String> {
    #[cfg(not(windows))]
    {
        config
            .path(&MAPPING_PATH)
            .and_then(|m| m.obj(key))
            .and_then(|m| m.str("name"))
            .filter(|n| !n.is_empty())
            .map(str::to_string)
    }
    #[cfg(windows)]
    {
        let _ = (config, key);
        None
    }
}

/// Force `tool` on the game filed under `key`, or with "" hand it back to
/// Steam's default.
#[cfg(not(windows))]
fn force_tool(config: &mut Obj, key: &str, tool: &str) {
    let mapping = config.path_mut(&MAPPING_PATH);
    if tool.is_empty() {
        mapping.remove(key);
        return;
    }
    let entry = mapping.path_mut(&[key]);
    entry.set_str("name", tool);
    entry.set_str("config", "");
    entry.set_str("priority", "250");
}

#[cfg(windows)]
fn set_game_shortcut(_: &tauri::AppHandle, _: bool) -> AppResult<()> {
    Err(AppError::new(ErrorCode::SteamNotFound))
}

/// Steam closed, both files are written: the shortcut in `shortcuts.vdf`,
/// and in `config.vdf` the Proton build it is forced onto — the one already
/// there for an adopted shortcut, else the head of what Steam can use (the
/// launch wrapper's Steam option changes it after). Adding it also points
/// Play at it: the launch wrapper's Steam option, on this shortcut's id.
/// Removing it also takes out a launcher shortcut an older version added
/// here, and puts Play back on the default wrapper if it was starting the
/// shortcut that went.
#[cfg(not(windows))]
fn set_game_shortcut(app: &tauri::AppHandle, add: bool) -> AppResult<()> {
    let (steam, user) = writable_steam(true)?;
    let user = user.unwrap();
    let s = settings::load(app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let root = PathBuf::from(&s.game_path);
    let file = shortcuts_file(&steam, &user);
    let mut tree = read_shortcuts(&file)?;
    let config = steam.config_vdf();
    let mut config_tree = read_text(&config)?;
    let grid = steam.user_config(&user).join("grid");

    if add {
        let exe = steam_game_exe(&root).ok_or_else(|| {
            AppError::new(ErrorCode::NoGameBinary)
                .with("dir", root.join("g3").join("Binaries").join("Win64").display())
                .with("names", game::WIN64_EXES.join(", "))
        })?;
        let appid = apply_game_shortcut(&mut tree, &root, &exe, true).unwrap();
        let key = appid.to_string();
        if forced_tool(&config_tree, &key).is_none() {
            if let Some(tool) = game::steam_compat_tools(&steam).into_iter().find_map(|o| o.tool) {
                force_tool(&mut config_tree, &key, &tool);
            }
        }
        write_steam_file(&file, &vdf::write_binary(&tree))?;
        write_steam_file(&config, vdf::write_text(&config_tree).as_bytes())?;
        fs::create_dir_all(&grid)?;
        for (suffix, bytes) in ART {
            let path = grid.join(format!("{appid}{suffix}"));
            if !path.exists() {
                fs::write(path, bytes)?;
            }
        }
        settings::mutate(app, |s| {
            s.launch_command = format!("steam steam://rungameid/{}", rungameid(appid));
        })?;
    } else {
        let ids = game_shortcut_ids(&mut tree, &root);
        apply_game_shortcut(&mut tree, &root, Path::new(""), false);
        apply_shortcut(&mut tree, &launcher_path()?, "", false);
        for id in &ids {
            force_tool(&mut config_tree, &id.to_string(), "");
            // Only the artwork we put there: a player's own picks stay.
            for (suffix, bytes) in ART {
                let path = grid.join(format!("{id}{suffix}"));
                if fs::read(&path).is_ok_and(|b| b == bytes) {
                    let _ = fs::remove_file(path);
                }
            }
        }
        write_steam_file(&file, &vdf::write_binary(&tree))?;
        write_steam_file(&config, vdf::write_text(&config_tree).as_bytes())?;
        let ours: Vec<String> =
            ids.iter().map(|id| format!("steam steam://rungameid/{}", rungameid(*id))).collect();
        if ours.contains(&s.launch_command.trim().to_string()) {
            settings::mutate(app, |s| s.launch_command = settings::Settings::default().launch_command)?;
        }
    }
    Ok(())
}

/* ---- commands ---- */

#[tauri::command]
#[specta::specta]
pub fn steam_status(app: tauri::AppHandle) -> SteamStatus {
    let Some(steam) = Steam::locate() else { return SteamStatus::default() };
    let user = steam.active_user();
    let game = game_shortcut_id(&steam, user.as_deref(), &settings::load(&app).game_path);
    SteamStatus {
        found: true,
        running: steam.running(),
        has_user: user.is_some(),
        spellbreak_installed: steam.app_installed(SPELLBREAK_APPID),
        linked: linked(&steam, user.as_deref()),
        shortcut: if cfg!(windows) { shortcut_present(&steam, user.as_deref()) } else { game.is_some() },
        root: steam.root.display().to_string(),
    }
}

#[tauri::command]
#[specta::specta]
pub fn steam_set_linked(app: tauri::AppHandle, linked: bool) -> AppResult<SteamStatus> {
    if linked && !Steam::locate().is_some_and(|s| s.app_installed(SPELLBREAK_APPID)) {
        return Err(AppError::new(ErrorCode::SpellbreakNotInSteam));
    }
    set_linked(&app, linked)?;
    Ok(steam_status(app))
}

/// The launcher's shortcut on Windows, the game's on Linux.
#[tauri::command]
#[specta::specta]
pub fn steam_set_shortcut(app: tauri::AppHandle, added: bool) -> AppResult<SteamStatus> {
    if cfg!(windows) {
        set_shortcut(&app, added)?;
    } else {
        set_game_shortcut(&app, added)?;
    }
    Ok(steam_status(app))
}

/// Steam's game id for the game's shortcut, for the launch wrapper's Steam
/// option: whichever shortcut starts this game folder, the launcher's own
/// or one the player made by hand. None when there is none (Linux only).
#[tauri::command]
#[specta::specta]
pub fn steam_game_id(app: tauri::AppHandle) -> Option<String> {
    let steam = Steam::locate()?;
    let user = steam.active_user();
    game_shortcut_id(&steam, user.as_deref(), &settings::load(&app).game_path)
        .map(|id| rungameid(id).to_string())
}

/// The Proton build Steam forces on the game behind `game_id` (what
/// `steam://rungameid/` takes), by Steam's name. None for Steam's default.
#[tauri::command]
#[specta::specta]
pub fn steam_compat_tool(game_id: String) -> Option<String> {
    let steam = Steam::locate()?;
    forced_tool(&read_text(&steam.config_vdf()).ok()?, &compat_key(&game_id)?)
}

/// Force a Proton build (Steam's name for it) on the game behind `game_id`,
/// or with "" hand it back to Steam's default. Needs Steam closed.
#[tauri::command]
#[specta::specta]
pub fn steam_set_compat_tool(game_id: String, tool: String) -> AppResult<()> {
    #[cfg(windows)]
    {
        let _ = (game_id, tool);
        Err(AppError::new(ErrorCode::SteamNotFound))
    }
    #[cfg(not(windows))]
    {
        let key = compat_key(&game_id)
            .ok_or_else(|| AppError::detail(ErrorCode::Io, format!("not a Steam game id: {game_id}")))?;
        let (steam, _) = writable_steam(false)?;
        let file = steam.config_vdf();
        let mut tree = read_text(&file)?;
        force_tool(&mut tree, &key, tool.trim());
        write_steam_file(&file, vdf::write_text(&tree).as_bytes())
    }
}

/// The Proton builds Steam can force on the game shortcut.
#[tauri::command]
#[specta::specta]
pub fn steam_compat_tools() -> Vec<game::ProtonOption> {
    if cfg!(windows) {
        return Vec::new();
    }
    Steam::locate().map(|s| game::steam_compat_tools(&s)).unwrap_or_default()
}

/// Ask Steam to exit, so its settings can be changed.
#[tauri::command]
#[specta::specta]
pub fn steam_shutdown() -> AppResult<()> {
    let steam = Steam::locate().ok_or_else(|| AppError::new(ErrorCode::SteamNotFound))?;
    let mut argv: Vec<String> = Vec::new();
    if platform::in_container() {
        argv.push("distrobox-host-exec".into());
    }
    if cfg!(windows) {
        argv.push(steam.root.join("steam.exe").display().to_string());
    } else {
        argv.push("steam".into());
    }
    argv.push("-shutdown".into());
    let mut cmd = std::process::Command::new(&argv[0]);
    cmd.args(&argv[1..])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    cmd.spawn()
        .map_err(|e| AppError::detail(ErrorCode::LaunchFailed, e).with("command", argv.join(" ")))?;
    Ok(())
}

#[cfg(test)]
#[path = "__tests/link.rs"]
mod tests;
