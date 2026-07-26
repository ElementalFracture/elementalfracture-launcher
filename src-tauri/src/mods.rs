use crate::settings;
use serde::Serialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

pub const LOADER_DLL: &str = "xinput1_3.dll";
pub const MOD_DLLS: &[&str] = &[
    "auth_injector.dll",
    "ef_controller.dll",
    "server_router.dll",
    "crouch_mod.dll",
];

#[derive(Serialize, specta::Type)]
pub struct FileCheck {
    pub label: String,
    pub path: String,
    pub present: bool,
}

fn win64_dir(root: &Path) -> PathBuf {
    root.join("g3").join("Binaries").join("Win64")
}

#[tauri::command]
#[specta::specta]
pub fn verify_install(app: tauri::AppHandle) -> Vec<FileCheck> {
    let s = settings::load(&app);
    let root = PathBuf::from(&s.game_path);
    let mut out = Vec::new();
    {
        let mut check = |label: &str, p: PathBuf| {
            out.push(FileCheck {
                label: label.into(),
                present: p.exists(),
                path: p.to_string_lossy().into_owned(),
            })
        };
        check("Mod loader", win64_dir(&root).join(LOADER_DLL));
        for dll in MOD_DLLS {
            check(dll, root.join("Mods").join("dlls").join(dll));
        }
    }
    // Auth is no longer verified here — it lives in the launcher and is handed
    // to the game in memory at launch, never written into the game folder.
    out
}

/// Download mod.zip from the CDN and install it into the game folder.
/// Port of install.bat: purge old Mods/dlls/*.dll, drop the loader into
/// g3/Binaries/Win64, copy the mod DLLs. Shared by the Mods-view button
/// and the install/update pipeline (patch → mods → version bump).
pub async fn fetch_and_install(cdn_base: &str, root: PathBuf) -> Result<Vec<String>, String> {
    if !win64_dir(&root).is_dir() {
        return Err("That folder doesn't look like a Spellbreak install (missing g3/Binaries/Win64).".into());
    }

    let url = format!("{}/patch/mod/mod.zip", cdn_base.trim_end_matches('/'));
    let resp = reqwest::get(&url)
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("mod download failed: {e}"))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("mod download failed: {e}"))?;
    if bytes.len() < 1024 {
        return Err("Downloaded mod.zip is suspiciously small: the CDN may have returned an error page.".into());
    }

    tauri::async_runtime::spawn_blocking(move || install_from_zip(&root, &bytes))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
#[specta::specta]
pub async fn install_mods(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err("Set the game folder first (Settings).".into());
    }
    fetch_and_install(&s.cdn_base, PathBuf::from(&s.game_path)).await
}

fn extract_one(
    zip: &mut zip::ZipArchive<Cursor<&[u8]>>,
    name: &str,
    dest: &Path,
) -> Result<bool, String> {
    match zip.by_name(name) {
        Ok(mut f) => {
            let mut buf = Vec::with_capacity(f.size() as usize);
            std::io::copy(&mut f, &mut buf).map_err(|e| e.to_string())?;
            fs::write(dest, buf).map_err(|e| format!("{}: {e}", dest.display()))?;
            Ok(true)
        }
        Err(zip::result::ZipError::FileNotFound) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

fn install_from_zip(root: &Path, bytes: &[u8]) -> Result<Vec<String>, String> {
    let mut zip =
        zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("bad zip: {e}"))?;
    let mut log = Vec::new();

    let dlls_dir = root.join("Mods").join("dlls");
    let cmds_dir = root.join("Mods").join("commands");
    fs::create_dir_all(&dlls_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&cmds_dir).map_err(|e| e.to_string())?;

    // Purge stale mod DLLs so removed mods from older versions can't linger.
    // Only *.dll inside Mods/dlls — configs and logs are left alone.
    if let Ok(rd) = fs::read_dir(&dlls_dir) {
        for entry in rd.flatten() {
            let p = entry.path();
            if p.extension().is_some_and(|x| x.eq_ignore_ascii_case("dll")) {
                let _ = fs::remove_file(&p);
            }
        }
        log.push("Removed old Mods/dlls/*.dll".into());
    }

    // Auth moved into the launcher (passed via environment at launch) —
    // scrub the old plaintext files.
    for legacy in ["auth_token.txt", "ef_server.txt"] {
        if fs::remove_file(cmds_dir.join(legacy)).is_ok() {
            log.push(format!("Removed legacy Mods/commands/{legacy}"));
        }
    }

    if extract_one(&mut zip, LOADER_DLL, &win64_dir(root).join(LOADER_DLL))? {
        log.push(format!("Installed {LOADER_DLL} (loader)"));
    } else {
        log.push(format!("MISSING in package: {LOADER_DLL}"));
    }

    for dll in MOD_DLLS {
        if extract_one(&mut zip, dll, &dlls_dir.join(dll))? {
            log.push(format!("Installed {dll}"));
        } else {
            log.push(format!("MISSING in package: {dll}"));
        }
    }

    // ef_server.txt from the package is deliberately NOT installed anymore —
    // the launcher provides the server via the environment.

    Ok(log)
}

