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
    } else if paks.join(format!("{PAK}.1")).exists() {
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

    let rename = |from: String, to: String| -> Result<(), String> {
        let (f, t) = (paks.join(&from), paks.join(&to));
        if f.exists() {
            fs::rename(&f, &t).map_err(|e| format!("{from}: {e}"))
        } else {
            Ok(())
        }
    };

    match variant.as_str() {
        "ef" => {
            rename(format!("{PAK}.1"), PAK.into())?;
            rename(format!("{SIG}.1"), SIG.into())?;
        }
        "classic" => {
            rename(PAK.into(), format!("{PAK}.1"))?;
            rename(SIG.into(), format!("{SIG}.1"))?;
        }
        other => return Err(format!("unknown variant: {other}")),
    }
    Ok(detect_variant(Path::new(&s.game_path)))
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
        let wrapper = s.launch_command.split_whitespace().next().unwrap().to_string();
        if !wrapper_available(&wrapper) {
            return Err(format!(
                "'{wrapper}' isn't installed{}. Set a different Launch wrapper in Settings \
                 (e.g. wine or umu-run).",
                if settings::in_container() { " on the host" } else { "" }
            ));
        }
        argv.extend(s.launch_command.split_whitespace().map(str::to_string));
    }
    argv.push(exe.to_string_lossy().into_owned());

    let mut cmd = std::process::Command::new(&argv[0]);
    cmd.args(&argv[1..]);
    cmd.current_dir(exe.parent().unwrap());

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

    // Scrub legacy visible plaintext copies from older installs.
    let cmds_dir = root.join("Mods").join("commands");
    let _ = fs::remove_file(cmds_dir.join("auth_token.txt"));
    let _ = fs::remove_file(cmds_dir.join("ef_server.txt"));

    cmd.spawn()
        .map_err(|e| format!("failed to launch ({}): {e}", argv.join(" ")))?;
    Ok(())
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
