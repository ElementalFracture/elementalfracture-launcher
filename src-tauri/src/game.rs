use crate::settings;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const PAK: &str = "ElefracBalance_P.pak";
const SIG: &str = "ElefracBalance_P.sig";

#[derive(Serialize)]
pub struct GameStatus {
    pub game_path: String,
    pub valid: bool,
    pub exe_present: bool,
    /// "ef" | "classic" | "unknown"
    pub variant: String,
    pub local_version: Option<String>,
}

/// The game binary goes by different names depending on the distribution:
/// retail installs ship g3/Binaries/Win64/Spellbreak.exe, the community
/// base archive ships g3-Win64-Test.exe (plus a root-level Spellbreak.exe
/// shim, which we only fall back to if no Win64 binary exists).
const WIN64_EXES: &[&str] = &[
    "Spellbreak.exe",
    "g3-Win64-Test.exe",
    "g3-Win64-Shipping.exe",
    "g3.exe",
];

pub fn find_exe(root: &Path) -> Option<PathBuf> {
    let dir = root.join("g3").join("Binaries").join("Win64");
    for name in WIN64_EXES {
        let p = dir.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    let shim = root.join("Spellbreak.exe");
    shim.exists().then_some(shim)
}

pub fn paks_dir(root: &Path) -> PathBuf {
    root.join("g3").join("Content").join("Paks")
}

/// version.txt from the old launcher is UTF-16LE with a BOM; ours (and the
/// CDN's) may be plain UTF-8. Handle both.
pub fn decode_version_bytes(bytes: &[u8]) -> String {
    let s = if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let units: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&units)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    };
    s.trim_matches(|c: char| c.is_whitespace() || c == '\0').to_string()
}

pub fn read_local_version(root: &Path) -> Option<String> {
    let v = decode_version_bytes(&fs::read(root.join("version.txt")).ok()?);
    (!v.is_empty()).then_some(v)
}

pub fn detect_variant(root: &Path) -> String {
    let paks = paks_dir(root);
    if paks.join(PAK).exists() {
        "ef".into()
    } else if paks.is_dir() {
        // No active balance pak — whether it's parked as .pak.1 or simply
        // not installed, the game plays vanilla.
        "classic".into()
    } else {
        "unknown".into()
    }
}

#[tauri::command]
pub fn get_status(app: tauri::AppHandle) -> GameStatus {
    let s = settings::load(&app);
    let root = PathBuf::from(&s.game_path);
    GameStatus {
        valid: !s.game_path.is_empty() && root.join("g3").is_dir(),
        exe_present: find_exe(&root).is_some(),
        variant: detect_variant(&root),
        local_version: read_local_version(&root),
        game_path: s.game_path,
    }
}

/// Look for an existing Spellbreak install in the usual places.
#[tauri::command]
pub fn auto_find_game() -> Option<String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    {
        for drive in ["C:", "D:", "E:"] {
            for sub in [
                "\\Program Files\\Spellbreak",
                "\\Program Files\\Epic Games\\Spellbreak",
                "\\Program Files (x86)\\Epic Games\\Spellbreak",
                "\\Program Files (x86)\\Steam\\steamapps\\common\\Spellbreak",
                "\\SteamLibrary\\steamapps\\common\\Spellbreak",
                "\\Games\\Spellbreak",
                "\\Spellbreak",
            ] {
                candidates.push(PathBuf::from(format!("{drive}{sub}")));
            }
        }
    }

    #[cfg(not(windows))]
    {
        if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
            for sub in [
                "Games/Spellbreak",
                ".local/share/Steam/steamapps/common/Spellbreak",
                ".steam/steam/steamapps/common/Spellbreak",
                ".wine/drive_c/Program Files/Spellbreak",
                ".wine/drive_c/Program Files/Epic Games/Spellbreak",
            ] {
                candidates.push(home.join(sub));
            }
            // Anything directly under ~/Games counts as a candidate too.
            if let Ok(rd) = fs::read_dir(home.join("Games")) {
                for e in rd.flatten() {
                    candidates.push(e.path());
                }
            }
        }
    }

    candidates
        .into_iter()
        .find(|c| find_exe(c).is_some())
        .map(|p| p.to_string_lossy().into_owned())
}

/// Switch between Elemental Fracture ("ef") and vanilla Spellbreak
/// ("classic") by renaming the balance pak in and out of the way,
/// exactly like the old rename.bat / restore.bat did.
#[tauri::command]
pub fn set_variant(app: tauri::AppHandle, variant: String) -> Result<String, String> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err("Set the game folder first (Settings).".into());
    }
    let paks = paks_dir(Path::new(&s.game_path));
    if !paks.is_dir() {
        return Err(format!("Paks folder not found: {}", paks.display()));
    }

    apply_variant(&paks, &variant)?;
    let current = detect_variant(Path::new(&s.game_path));
    // Tell the in-game controller which balance is active so it can re-skin + swap its
    // Loadout data to match (read by auth_injector from this marker at launch).
    write_hidden_mode(Path::new(&s.game_path), &current);
    Ok(current)
}

/// Rename the balance pak (and its .sig) in or out of the way. Robust
/// against the states the simple rename tripped over: a stale copy on the
/// destination side (updates re-deliver the pak while Classic is parked as
/// .pak.1 — Windows fs::rename refuses to overwrite) and a pak that was
/// never installed at all.
fn apply_variant(paks: &Path, variant: &str) -> Result<(), String> {
    match variant {
        "ef" => {
            for name in [PAK, SIG] {
                let active = paks.join(name);
                let parked = paks.join(format!("{name}.1"));
                if active.exists() {
                    // A fresh update already put the real file back — the
                    // parked copy is stale, drop it.
                    let _ = fs::remove_file(&parked);
                } else if parked.exists() {
                    fs::rename(&parked, &active).map_err(|e| format!("{name}.1: {e}"))?;
                }
            }
            if !paks.join(PAK).exists() {
                return Err(format!(
                    "{PAK} isn't in the Paks folder: run Install / Update mods first."
                ));
            }
        }
        "classic" => {
            for name in [PAK, SIG] {
                let active = paks.join(name);
                let parked = paks.join(format!("{name}.1"));
                if active.exists() {
                    let _ = fs::remove_file(&parked);
                    fs::rename(&active, &parked).map_err(|e| format!("{name}: {e}"))?;
                }
                // Neither file present: nothing to park, vanilla already.
            }
        }
        other => return Err(format!("unknown variant: {other}")),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn paks(files: &[&str]) -> (tempfile::TempDir, PathBuf) {
        let tmp = tempfile::tempdir().unwrap();
        let paks = paks_dir(tmp.path());
        fs::create_dir_all(&paks).unwrap();
        for f in files {
            fs::write(paks.join(f), b"x").unwrap();
        }
        (tmp, paks)
    }

    fn names(paks: &Path) -> Vec<String> {
        let mut v: Vec<String> = fs::read_dir(paks)
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        v.sort();
        v
    }

    #[test]
    fn parked_to_ef_and_back() {
        let (tmp, p) = paks(&["ElefracBalance_P.pak.1", "ElefracBalance_P.sig.1"]);
        assert_eq!(detect_variant(tmp.path()), "classic");
        apply_variant(&p, "ef").unwrap();
        assert_eq!(names(&p), ["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
        assert_eq!(detect_variant(tmp.path()), "ef");
        apply_variant(&p, "classic").unwrap();
        assert_eq!(names(&p), ["ElefracBalance_P.pak.1", "ElefracBalance_P.sig.1"]);
    }

    #[test]
    fn both_copies_present_after_update() {
        let (tmp, p) = paks(&[
            "ElefracBalance_P.pak",
            "ElefracBalance_P.pak.1",
            "ElefracBalance_P.sig",
            "ElefracBalance_P.sig.1",
        ]);
        assert_eq!(detect_variant(tmp.path()), "ef");
        apply_variant(&p, "classic").unwrap();
        assert_eq!(names(&p), ["ElefracBalance_P.pak.1", "ElefracBalance_P.sig.1"]);
        apply_variant(&p, "ef").unwrap();
        assert_eq!(names(&p), ["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
    }

    #[test]
    fn pak_never_installed() {
        let (tmp, p) = paks(&[]);
        // Vanilla paks folder: classic is simply the truth.
        assert_eq!(detect_variant(tmp.path()), "classic");
        apply_variant(&p, "classic").unwrap();
        // EF without the pak anywhere must fail loudly, not pretend.
        let err = apply_variant(&p, "ef").unwrap_err();
        assert!(err.contains("Install / Update mods"), "{err}");
    }

    #[test]
    fn no_paks_dir_is_unknown() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(detect_variant(tmp.path()), "unknown");
    }
}

#[derive(Serialize)]
pub struct WrapperOption {
    pub command: String,
    pub label: String,
}

/// Run a command (on the host when the launcher lives in a container) and
/// return its stdout on success.
fn host_cmd_output(args: &[&str]) -> Option<String> {
    let mut argv: Vec<&str> = Vec::new();
    if settings::in_container() {
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
        if let Some(path) = host_cmd_output(&["sh", "-c", &format!("command -v {cand}")]) {
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

/// Check the launch wrapper exists where the game will actually run
/// (on the host when the launcher itself lives in a container).
fn wrapper_available(prog: &str) -> bool {
    let check = format!("command -v {prog} >/dev/null 2>&1");
    let mut cmd = if settings::in_container() {
        let mut c = std::process::Command::new("distrobox-host-exec");
        c.args(["sh", "-c", &check]);
        c
    } else {
        let mut c = std::process::Command::new("sh");
        c.args(["-c", &check]);
        c
    };
    cmd.stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|st| st.success())
        .unwrap_or(true) // if the check itself fails, don't block the launch
}

/// Locate an installed Proton to pin via PROTONPATH — GE-Proton preferred and
/// newest-by-name, falling back to any Proton build. Lets umu run on a
/// known-good runtime (DXVK/vkd3d) instead of whatever it defaults to.
fn detect_proton_path() -> Option<String> {
    let home = std::env::var_os("HOME").map(PathBuf::from)?;
    let roots = [
        ".steam/steam/compatibilitytools.d",
        ".steam/root/compatibilitytools.d",
        ".local/share/Steam/compatibilitytools.d",
        ".local/share/Steam/steamapps/common",
    ];
    let (mut ge, mut other): (Vec<PathBuf>, Vec<PathBuf>) = (Vec::new(), Vec::new());
    for r in roots {
        let Ok(rd) = fs::read_dir(home.join(r)) else { continue };
        for e in rd.flatten() {
            let p = e.path();
            // A real Proton dir has a `proton` launcher script.
            if !p.join("proton").exists() {
                continue;
            }
            let name = e.file_name().to_string_lossy().into_owned();
            if name.starts_with("GE-Proton") {
                ge.push(p);
            } else if name.contains("Proton") {
                other.push(p);
            }
        }
    }
    ge.sort();
    other.sort();
    ge.pop().or_else(|| other.pop()).map(|p| p.to_string_lossy().into_owned())
}

/// Persist the xinput1_3 override (native,builtin — load the app-local EF mod
/// loader) into the Wine/Proton prefix registry so it survives game relaunches
/// that don't inherit our WINEDLLOVERRIDES env var. Best-effort and idempotent
/// (guarded by a marker), and only after the prefix is initialized so we never
/// block or corrupt first-run prefix creation.
fn ensure_prefix_override(wrapper: &str, prefix: &str, is_proton: bool, proton_path: Option<&str>) {
    if prefix.is_empty() {
        return;
    }
    let p = Path::new(prefix);
    let marker = p.join(".ef_dlloverride");
    if marker.exists() {
        return;
    }
    // Wine keeps user.reg at the prefix root; Proton nests it under pfx/. If
    // neither exists yet the prefix hasn't been built — let the env var cover
    // the first run and bake it in on the next launch.
    if !p.join("user.reg").exists() && !p.join("pfx").join("user.reg").exists() {
        return;
    }

    let mut argv: Vec<String> = Vec::new();
    if settings::in_container() {
        argv.push("distrobox-host-exec".into());
    }
    // Env rides in via `env` (survives the distrobox relay), same as launch.
    argv.push("env".into());
    argv.push(format!("WINEPREFIX={prefix}"));
    if is_proton {
        argv.push("GAMEID=umu-0".into());
        if let Some(proton) = proton_path {
            argv.push(format!("PROTONPATH={proton}"));
        }
    }
    argv.extend(wrapper.split_whitespace().map(str::to_string));
    for a in [
        "reg", "add", r"HKEY_CURRENT_USER\Software\Wine\DllOverrides",
        "/v", "xinput1_3", "/d", "native,builtin", "/f",
    ] {
        argv.push(a.into());
    }

    let mut cmd = std::process::Command::new(&argv[0]);
    cmd.args(&argv[1..]);
    cmd.stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    sanitize_appimage_env(&mut cmd); // umu-run is python — the AppImage env kills it
    let ok = cmd.status().map(|st| st.success()).unwrap_or(false);
    if ok {
        let _ = fs::write(&marker, b"native,builtin\n");
    }
}

#[tauri::command]
pub fn launch_game(app: tauri::AppHandle) -> Result<(), String> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err("Set the game folder first (Settings).".into());
    }
    let root = PathBuf::from(&s.game_path);
    let Some(exe) = find_exe(&root) else {
        return Err(format!(
            "No game binary found in {} (looked for {})",
            root.join("g3").join("Binaries").join("Win64").display(),
            WIN64_EXES.join(", ")
        ));
    };

    let mut argv: Vec<String> = Vec::new();

    // Dev builds run inside a distrobox where wine isn't installed —
    // run the whole command on the host instead.
    if settings::in_container() {
        argv.push("distrobox-host-exec".into());
    }
    if !cfg!(windows) && !s.launch_command.trim().is_empty() {
        // Resolve the wrapper we'll actually use. If the configured one is
        // missing (e.g. the default "wine" on a box that only has Proton),
        // fall back to umu-run instead of dead-ending on an error.
        let mut launch_command = s.launch_command.trim().to_string();
        let wrapper = launch_command.split_whitespace().next().unwrap().to_string();
        if !wrapper_available(&wrapper) {
            if wrapper != "umu-run" && wrapper_available("umu-run") {
                launch_command = "umu-run".into();
            } else {
                return Err(format!(
                    "'{wrapper}' isn't installed{}. Set a different Launch wrapper in Settings \
                     (e.g. wine or umu-run).",
                    if settings::in_container() { " on the host" } else { "" }
                ));
            }
        }
        let is_proton = launch_command.contains("umu") || launch_command.contains("proton");

        // Everything Wine/Proton needs rides in via `env` so it survives even
        // when the command is relayed through distrobox-host-exec (which does
        // not forward plain process env vars).
        let mut envs: Vec<String> = Vec::new();

        // Prefix. With none chosen the launcher supplies its own dedicated one
        // (umu/wine create it on first launch), so the game never shares or
        // converts anyone else's prefix.
        let managed_prefix;
        let mut prefix = s.wine_prefix.trim();
        if prefix.is_empty() {
            use tauri::Manager;
            if let Ok(dir) = app.path().app_data_dir() {
                let p = dir.join("prefix");
                let _ = fs::create_dir_all(&p);
                managed_prefix = p.to_string_lossy().into_owned();
                prefix = &managed_prefix;
            }
        }
        if !prefix.is_empty() {
            // Proton-based wrappers ADOPT an existing plain-Wine prefix by
            // rewriting its registry and layout, which can break the app
            // that owns it (e.g. an XIVLauncher prefix). Refuse rather
            // than convert someone else's prefix behind their back.
            let p = Path::new(prefix);
            let foreign_wine = p.join("system.reg").exists()
                && !p.join("tracked_files").exists()
                && !p.join("pfx").exists();
            if is_proton && foreign_wine {
                return Err(format!(
                    "The prefix at {prefix} was made by a different Wine, and \
                     {} would permanently convert it (possibly breaking the app \
                     that owns it). Pick an empty folder to get a fresh prefix, \
                     or clear the field to use the default.",
                    launch_command
                ));
            }
            envs.push(format!("WINEPREFIX={prefix}"));
        }

        // umu/Proton needs a game id, and we pin an installed GE-Proton (or any
        // Proton) so rendering runs on a known-good runtime with DXVK rather
        // than whatever umu would pick by default.
        let proton_path = if is_proton { detect_proton_path() } else { None };
        if is_proton {
            envs.push("GAMEID=umu-0".into());
            if let Some(proton) = &proton_path {
                envs.push(format!("PROTONPATH={proton}"));
            }
        }

        // Also bake the xinput1_3 override into the prefix registry. The env
        // var below only reaches the process we spawn; a self-relaunch (or a
        // manual Steam run of the same prefix) loses it, and Proton then falls
        // back to its builtin xinput1_3, silently dropping the mod loader.
        // Once it's in the registry the override sticks regardless. Best-effort
        // and once per prefix.
        ensure_prefix_override(&launch_command, prefix, is_proton, proton_path.as_deref());

        // Force the app-local xinput1_3.dll — the EF mod loader — to load.
        // Wine and Proton default xinput1_3 to their own builtin, which
        // silently ignores the loader sitting next to the exe (on Windows the
        // app-dir DLL wins for free, which is why mods only vanish under Wine).
        // Merge with any inherited overrides instead of clobbering them.
        let inherited = std::env::var("WINEDLLOVERRIDES").unwrap_or_default();
        let overrides = if inherited.trim().is_empty() {
            "xinput1_3=n,b".to_string()
        } else {
            format!("{};xinput1_3=n,b", inherited.trim())
        };
        envs.push(format!("WINEDLLOVERRIDES={overrides}"));

        argv.push("env".into());
        argv.extend(envs);
        argv.extend(launch_command.split_whitespace().map(str::to_string));
    }
    argv.push(exe.to_string_lossy().into_owned());

    let mut cmd = std::process::Command::new(&argv[0]);
    cmd.args(&argv[1..]);
    cmd.current_dir(exe.parent().unwrap());
    sanitize_appimage_env(&mut cmd);

    // Auth handoff. Env vars first (free, works if the game doesn't relaunch),
    // but the reliable channel is a hidden .ef_auth file in the game root —
    // the injector resolves the game folder identically on Windows and wine,
    // unlike %APPDATA%. Written fresh each launch.
    let server_host = settings::game_host(&s.auth_url);
    if !s.auth_token.trim().is_empty() {
        cmd.env("EF_AUTH_TOKEN", s.auth_token.trim());
    }
    if !server_host.is_empty() {
        cmd.env("EF_SERVER", &server_host);
    }
    write_hidden_auth(&root, s.auth_token.trim(), &server_host);
    // Current balance mode, written fresh each launch so the controller matches the loaded pak.
    write_hidden_mode(&root, &detect_variant(&root));

    // Scrub legacy visible plaintext copies from older installs.
    let cmds_dir = root.join("Mods").join("commands");
    let _ = fs::remove_file(cmds_dir.join("auth_token.txt"));
    let _ = fs::remove_file(cmds_dir.join("ef_server.txt"));

    cmd.spawn()
        .map_err(|e| format!("failed to launch ({}): {e}", argv.join(" ")))?;
    Ok(())
}

/// Children must not inherit the AppImage runtime's environment: it points
/// PYTHONHOME / PYTHONPATH / LD_LIBRARY_PATH / PATH into the mounted image,
/// which instantly kills python-based wrappers like umu-run ("Fatal Python
/// error: Failed to import encodings module") and can break any host binary
/// the game chain execs. Colon-list vars get the mount entries filtered
/// out; everything else referencing the mount is dropped.
fn sanitize_appimage_env(cmd: &mut std::process::Command) {
    #[cfg(target_os = "linux")]
    {
        let Some(appdir) = std::env::var_os("APPDIR") else { return };
        let appdir = appdir.to_string_lossy().into_owned();
        if appdir.is_empty() {
            return;
        }
        for (k, v) in std::env::vars() {
            if !v.contains(&appdir) {
                continue;
            }
            if matches!(k.as_str(), "PATH" | "LD_LIBRARY_PATH" | "XDG_DATA_DIRS") {
                let cleaned: Vec<&str> = v
                    .split(':')
                    .filter(|p| !p.is_empty() && !p.contains(&appdir))
                    .collect();
                cmd.env(&k, cleaned.join(":"));
            } else {
                cmd.env_remove(&k);
            }
        }
        for k in ["PYTHONHOME", "PYTHONPATH", "PYTHONDONTWRITEBYTECODE", "APPDIR", "APPIMAGE", "OWD"] {
            cmd.env_remove(k);
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = cmd;
    }
}

/// Write (or clear) the hidden `.ef_auth` file the injector reads: line 0 the
/// token, line 1 the server. Marked Hidden on Windows (a dot prefix only
/// hides it on Linux).
fn write_hidden_auth(root: &Path, token: &str, host: &str) {
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
fn write_hidden_mode(root: &Path, mode: &str) {
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
