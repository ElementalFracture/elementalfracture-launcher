use crate::settings;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

// The production (Elemental Fracture) balance pak, and the Playtest balance
// pak. Only one balance pak is ever mounted at a time; the others
// are parked out of the way as `<name>.bak` (older installs used `.1`).
const PAK: &str = "ElefracBalance_P.pak";
const SIG: &str = "ElefracBalance_P.sig";
const TEST_PAK: &str = "ElefracTest_P.pak";
const TEST_SIG: &str = "ElefracTest_P.sig";

/// Parked-copy suffixes, newest first: we write `.bak` but still restore a
/// legacy `.1` left by older launcher versions.
const PARK_SUFFIXES: &[&str] = &["bak", "1"];

#[derive(Serialize, specta::Type)]
pub struct GameStatus {
    pub game_path: String,
    pub valid: bool,
    pub exe_present: bool,
    /// "ef" (Production) | "classic" (Vanilla) | "playtest" | "unknown"
    pub variant: String,
    /// Whether the Playtest pak is present (active or parked), so the UI can
    /// offer "switch to it" rather than "download it first".
    pub test_installed: bool,
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
    if paks.join(TEST_PAK).exists() {
        // The Playtest pak is mounted.
        "playtest".into()
    } else if paks.join(PAK).exists() {
        "ef".into()
    } else if paks.is_dir() {
        // No active balance pak — whether they're parked as .bak or simply
        // not installed, the game plays vanilla.
        "classic".into()
    } else {
        "unknown".into()
    }
}

/// True when the Playtest pak is on disk at all (mounted or parked), so
/// switching to it needs no download.
pub fn test_build_installed(root: &Path) -> bool {
    let paks = paks_dir(root);
    paks.join(TEST_PAK).exists() || parked_path(&paks, TEST_PAK).is_some()
}

#[tauri::command]
#[specta::specta]
pub fn get_status(app: tauri::AppHandle) -> GameStatus {
    let s = settings::load(&app);
    let root = PathBuf::from(&s.game_path);
    GameStatus {
        valid: !s.game_path.is_empty() && root.join("g3").is_dir(),
        exe_present: find_exe(&root).is_some(),
        variant: detect_variant(&root),
        test_installed: test_build_installed(&root),
        local_version: read_local_version(&root),
        game_path: s.game_path,
    }
}

/// Look for an existing Spellbreak install in the usual places.
#[tauri::command]
#[specta::specta]
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

/// Switch the game between Production ("ef"), Vanilla ("classic") and the
/// Playtest channel ("playtest") by parking the balance paks we don't want and
/// restoring the one we do, exactly like the old rename.bat / restore.bat did.
#[tauri::command]
#[specta::specta]
pub fn set_variant(app: tauri::AppHandle, variant: String) -> Result<String, String> {
    let s = settings::load(&app);
    switch_to(&s.game_path, &variant)
}

/// Core of set_variant, reusable by the Playtest installer: apply the
/// variant's pak layout and refresh the `.ef_mode` marker to match.
pub fn switch_to(game_path: &str, variant: &str) -> Result<String, String> {
    if game_path.is_empty() {
        return Err("Set the game folder first (Settings).".into());
    }
    let root = Path::new(game_path);
    let paks = paks_dir(root);
    if !paks.is_dir() {
        return Err(format!("Paks folder not found: {}", paks.display()));
    }

    apply_variant(&paks, variant)?;
    let current = detect_variant(root);
    // Tell the in-game controller which balance is active so it can re-skin + swap its
    // Loadout data to match (read by auth_injector from this marker at launch).
    write_hidden_mode(root, &current);
    Ok(current)
}

/// The path of a parked copy of `name` if one exists (`.bak`, or legacy `.1`).
fn parked_path(paks: &Path, name: &str) -> Option<PathBuf> {
    PARK_SUFFIXES
        .iter()
        .map(|s| paks.join(format!("{name}.{s}")))
        .find(|p| p.exists())
}

/// Make `name` the active file: if it's parked and not already active, restore
/// it; if it's already active, drop any stale parked copies (updates can
/// re-deliver the real file while a copy is still parked). No-op when absent.
fn activate(paks: &Path, name: &str) -> Result<(), String> {
    let active = paks.join(name);
    if active.exists() {
        for s in PARK_SUFFIXES {
            let _ = fs::remove_file(paks.join(format!("{name}.{s}")));
        }
    } else if let Some(parked) = parked_path(paks, name) {
        fs::rename(&parked, &active).map_err(|e| format!("{name}: {e}"))?;
    }
    Ok(())
}

/// Park `name` out of the way as `<name>.bak`. Windows fs::rename refuses to
/// overwrite, so clear a stale parked copy first; also drop any legacy `.1` so
/// detection stays unambiguous. No-op when the active file isn't present.
fn park(paks: &Path, name: &str) -> Result<(), String> {
    let active = paks.join(name);
    if active.exists() {
        let parked = paks.join(format!("{name}.bak"));
        let _ = fs::remove_file(&parked);
        fs::rename(&active, &parked).map_err(|e| format!("{name}: {e}"))?;
    }
    let _ = fs::remove_file(paks.join(format!("{name}.1")));
    Ok(())
}

/// Apply the pak layout for a variant. Only one balance pak is mounted at a
/// time; the rest are parked as `<name>.bak`.
fn apply_variant(paks: &Path, variant: &str) -> Result<(), String> {
    match variant {
        // Production: Elemental Fracture balance active, Playtest parked.
        "ef" => {
            for name in [PAK, SIG] {
                activate(paks, name)?;
            }
            for name in [TEST_PAK, TEST_SIG] {
                park(paks, name)?;
            }
            if !paks.join(PAK).exists() {
                return Err(format!(
                    "{PAK} isn't in the Paks folder: run Install / Update mods first."
                ));
            }
        }
        // Vanilla: both balance paks parked, stock game only.
        "classic" => {
            for name in [PAK, SIG, TEST_PAK, TEST_SIG] {
                park(paks, name)?;
            }
        }
        // Playtest: the playtest balance active, Elemental Fracture parked.
        "playtest" => {
            for name in [PAK, SIG] {
                park(paks, name)?;
            }
            for name in [TEST_PAK, TEST_SIG] {
                activate(paks, name)?;
            }
            if !paks.join(TEST_PAK).exists() {
                return Err(format!(
                    "{TEST_PAK} isn't installed: enable the Playtest build to download it first."
                ));
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
        // A legacy `.1` park still restores; parking now writes `.bak`.
        let (tmp, p) = paks(&["ElefracBalance_P.pak.1", "ElefracBalance_P.sig.1"]);
        assert_eq!(detect_variant(tmp.path()), "classic");
        apply_variant(&p, "ef").unwrap();
        assert_eq!(names(&p), ["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
        assert_eq!(detect_variant(tmp.path()), "ef");
        apply_variant(&p, "classic").unwrap();
        assert_eq!(names(&p), ["ElefracBalance_P.pak.bak", "ElefracBalance_P.sig.bak"]);
    }

    #[test]
    fn both_copies_present_after_update() {
        let (tmp, p) = paks(&[
            "ElefracBalance_P.pak",
            "ElefracBalance_P.pak.bak",
            "ElefracBalance_P.sig",
            "ElefracBalance_P.sig.bak",
        ]);
        assert_eq!(detect_variant(tmp.path()), "ef");
        apply_variant(&p, "classic").unwrap();
        assert_eq!(names(&p), ["ElefracBalance_P.pak.bak", "ElefracBalance_P.sig.bak"]);
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
    fn three_way_prod_playtest_vanilla() {
        // Both balance paks installed, production active.
        let (tmp, p) = paks(&[
            "ElefracBalance_P.pak",
            "ElefracBalance_P.sig",
            "ElefracTest_P.pak",
            "ElefracTest_P.sig",
        ]);
        // Prod: Test parked, Balance active.
        apply_variant(&p, "ef").unwrap();
        assert_eq!(detect_variant(tmp.path()), "ef");
        assert_eq!(
            names(&p),
            [
                "ElefracBalance_P.pak",
                "ElefracBalance_P.sig",
                "ElefracTest_P.pak.bak",
                "ElefracTest_P.sig.bak",
            ]
        );
        assert!(test_build_installed(tmp.path()));

        // Playtest: Balance parked, Playtest active.
        apply_variant(&p, "playtest").unwrap();
        assert_eq!(detect_variant(tmp.path()), "playtest");
        assert_eq!(
            names(&p),
            [
                "ElefracBalance_P.pak.bak",
                "ElefracBalance_P.sig.bak",
                "ElefracTest_P.pak",
                "ElefracTest_P.sig",
            ]
        );

        // Vanilla: both parked.
        apply_variant(&p, "classic").unwrap();
        assert_eq!(detect_variant(tmp.path()), "classic");
        assert_eq!(
            names(&p),
            [
                "ElefracBalance_P.pak.bak",
                "ElefracBalance_P.sig.bak",
                "ElefracTest_P.pak.bak",
                "ElefracTest_P.sig.bak",
            ]
        );
        assert!(test_build_installed(tmp.path()));

        // Back to prod from vanilla restores Balance, leaves Test parked.
        apply_variant(&p, "ef").unwrap();
        assert_eq!(detect_variant(tmp.path()), "ef");
    }

    #[test]
    fn playtest_without_pak_fails() {
        let (tmp, p) = paks(&["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
        assert!(!test_build_installed(tmp.path()));
        let err = apply_variant(&p, "playtest").unwrap_err();
        assert!(err.contains("enable the Playtest build"), "{err}");
    }

    #[test]
    fn no_paks_dir_is_unknown() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(detect_variant(tmp.path()), "unknown");
    }

    /// An executable at a path with a space in it — the shape that used to be
    /// torn in half at the space and reported as "isn't installed".
    fn spaced_wine() -> (tempfile::TempDir, String) {
        let tmp = tempfile::tempdir().unwrap();
        let dir = tmp.path().join("test space").join("bin");
        fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("wine");
        fs::write(&exe, b"#!/bin/sh\nexit 0\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&exe, fs::Permissions::from_mode(0o755)).unwrap();
        }
        let path = exe.to_string_lossy().into_owned();
        (tmp, path)
    }

    #[test]
    fn wrapper_path_with_spaces_stays_whole() {
        let (_tmp, path) = spaced_wine();
        assert_eq!(parse_wrapper(&path), std::slice::from_ref(&path));
        // Leading/trailing slack must not turn it into a word list either.
        assert_eq!(parse_wrapper(&format!("  {path}  ")), [path]);
    }

    #[test]
    fn multi_word_wrappers_still_split() {
        assert_eq!(
            parse_wrapper("flatpak run org.winehq.Wine"),
            ["flatpak", "run", "org.winehq.Wine"]
        );
        assert_eq!(
            parse_wrapper("steam steam://rungameid/18150169937639899136"),
            ["steam", "steam://rungameid/18150169937639899136"]
        );
        assert_eq!(parse_wrapper("umu-run"), ["umu-run"]);
        // An absolute path that isn't there falls back to the word split
        // rather than claiming to be a program.
        assert_eq!(parse_wrapper("/no/such/wine --foo"), ["/no/such/wine", "--foo"]);
    }

    #[cfg(unix)]
    #[test]
    fn availability_survives_spaces_and_quotes() {
        let (_tmp, path) = spaced_wine();
        assert!(wrapper_available(&path), "spaced path should resolve: {path}");
        assert!(wrapper_available("sh"));
        // A value carrying shell syntax must fail the check, not execute.
        let canary = tempfile::tempdir().unwrap();
        let target = canary.path().join("CANARY");
        fs::write(&target, b"x").unwrap();
        let evil = format!(r#"x" ; rm -f "{}" ; ""#, target.display());
        assert!(!wrapper_available(&evil));
        assert!(target.exists(), "injected command ran");
    }
}

#[derive(Serialize, specta::Type)]
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

/// Split the configured wrapper into argv. An absolute path that exists on
/// disk is the whole program, spaces and all — never a word list, or a wine
/// under "/opt/my wine/bin" gets torn in half. Everything else keeps the word
/// split, so multi-word wrappers ("flatpak run org.winehq.Wine") still work.
fn parse_wrapper(command: &str) -> Vec<String> {
    let trimmed = command.trim();
    if trimmed.starts_with('/') && Path::new(trimmed).is_file() {
        return vec![trimmed.to_string()];
    }
    trimmed.split_whitespace().map(str::to_string).collect()
}

/// Check the launch wrapper exists where the game will actually run
/// (on the host when the launcher itself lives in a container).
fn wrapper_available(prog: &str) -> bool {
    // `prog` rides in as an argument rather than spliced into the script text:
    // nothing user-controlled reaches the shell parser, so a path with spaces
    // survives and a path with quotes can't break out. "_" fills $0.
    const CHECK: &str = r#"command -v "$1" >/dev/null 2>&1"#;
    let mut cmd = if settings::in_container() {
        let mut c = std::process::Command::new("distrobox-host-exec");
        c.args(["sh", "-c", CHECK, "_", prog]);
        c
    } else {
        let mut c = std::process::Command::new("sh");
        c.args(["-c", CHECK, "_", prog]);
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
fn ensure_prefix_override(
    wrapper: &[String],
    prefix: &str,
    is_proton: bool,
    proton_path: Option<&str>,
) {
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
    argv.extend(wrapper.iter().cloned());
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
#[specta::specta]
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
        let mut wrapper_argv = parse_wrapper(&launch_command);
        let wrapper = wrapper_argv[0].clone();
        if !wrapper_available(&wrapper) {
            if wrapper != "umu-run" && wrapper_available("umu-run") {
                launch_command = "umu-run".into();
                wrapper_argv = vec!["umu-run".into()];
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
        ensure_prefix_override(&wrapper_argv, prefix, is_proton, proton_path.as_deref());

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
        argv.extend(wrapper_argv.iter().cloned());
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
