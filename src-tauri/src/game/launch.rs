//! Starting the game: the prefix and Proton the wrapper needs, the environment
//! it must NOT inherit, and the auth handoff that rides along.

use super::install::{find_exe, WIN64_EXES};
use super::markers::write_hidden_mode;
use super::proton::resolve_proton;
use super::variant::detect_variant;
use super::wrapper::{parse_wrapper, steam_run, wrapper_available};
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{platform, settings};
use std::fs;
use std::path::{Path, PathBuf};

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
    if platform::in_container() {
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
pub fn launch_game(app: tauri::AppHandle) -> AppResult<()> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let root = PathBuf::from(&s.game_path);
    let Some(exe) = find_exe(&root) else {
        return Err(AppError::new(ErrorCode::NoGameBinary)
            .with("dir", root.join("g3").join("Binaries").join("Win64").display())
            .with("names", WIN64_EXES.join(", ")));
    };

    let mut argv: Vec<String> = Vec::new();

    // Dev builds run inside a distrobox where wine isn't installed —
    // run the whole command on the host instead.
    if platform::in_container() {
        argv.push("distrobox-host-exec".into());
    }
    let steam_run = if cfg!(windows) { None } else { steam_run(&s.launch_command) };
    if let Some(run) = &steam_run {
        argv.extend(run.iter().cloned());
    } else if !cfg!(windows) && !s.launch_command.trim().is_empty() {
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
                return Err(AppError::new(ErrorCode::WrapperNotInstalled)
                    .with("wrapper", &wrapper)
                    .with("onHost", platform::in_container()));
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
                return Err(AppError::new(ErrorCode::ForeignWinePrefix)
                    .with("prefix", prefix)
                    .with("wrapper", &launch_command));
            }
            envs.push(format!("WINEPREFIX={prefix}"));
        }

        // umu/Proton needs a game id, and we pin an installed Proton — the one
        // picked in Settings, else GE-Proton (or any Proton) — so rendering
        // runs on a known runtime with DXVK rather than whatever umu would
        // pick by default.
        let proton_path = if is_proton { resolve_proton(&s.proton_path) } else { None };
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
    if steam_run.is_none() {
        argv.push(exe.to_string_lossy().into_owned());
    }

    let mut cmd = std::process::Command::new(&argv[0]);
    cmd.args(&argv[1..]);
    cmd.current_dir(exe.parent().unwrap());
    sanitize_appimage_env(&mut cmd);
    crate::steam::restore_game_env(&mut cmd);

    // Auth handoff: the environment the game is spawned with. Nothing is
    // written to the game folder — the session key stays out of a directory
    // that is routinely on a shared Steam library or a second drive.
    let server_host = settings::game_host(&s.auth_url);
    if !s.auth_token.trim().is_empty() {
        cmd.env("EF_AUTH_TOKEN", s.auth_token.trim());
    }
    if !server_host.is_empty() {
        cmd.env("EF_SERVER", &server_host);
    }
    // Current balance mode, written fresh each launch so the controller matches the loaded pak.
    write_hidden_mode(&root, &detect_variant(&root));

    // Scrub plaintext auth copies older launchers left in the game folder:
    // Mods/commands/*.txt, and the .ef_auth marker that replaced them. Every
    // launch, not just installs, so a copy that never sees another install
    // still goes away.
    let cmds_dir = root.join("Mods").join("commands");
    let _ = fs::remove_file(cmds_dir.join("auth_token.txt"));
    let _ = fs::remove_file(cmds_dir.join("ef_server.txt"));
    let _ = fs::remove_file(root.join(".ef_auth"));

    let child = cmd.spawn().map_err(|e| {
        AppError::detail(ErrorCode::LaunchFailed, e).with("command", argv.join(" "))
    })?;
    crate::steam::watch_game(&app, child);
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
