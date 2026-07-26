use crate::settings;
use serde::Serialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

// The loader is the one DLL that goes into the game's Win64 binary folder (the
// game imports it at startup); every OTHER *.dll in mod.zip goes into Mods/dlls.
// Nothing is hardcoded beyond this rule, so a new mod ships just by being in the zip.
pub const LOADER_DLL: &str = "xinput1_3.dll";

#[derive(Serialize)]
pub struct FileCheck {
    pub label: String,
    pub path: String,
    pub present: bool,
}

fn win64_dir(root: &Path) -> PathBuf {
    root.join("g3").join("Binaries").join("Win64")
}

#[tauri::command]
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
        // List whatever mod DLLs are actually installed — no fixed roster, so this
        // stays correct as mods are added/removed from mod.zip.
        let dlls_dir = root.join("Mods").join("dlls");
        let mut names: Vec<String> = fs::read_dir(&dlls_dir)
            .into_iter()
            .flatten()
            .flatten()
            .filter(|e| e.path().extension().is_some_and(|x| x.eq_ignore_ascii_case("dll")))
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort_unstable();
        for name in names {
            check(&name, dlls_dir.join(&name));
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

    // Place every .dll in the package: the loader → g3/Binaries/Win64, all other
    // DLLs → Mods/dlls. Collect entry names first (extract_one takes a fresh
    // mutable borrow per file).
    let win64 = win64_dir(root);
    let names: Vec<String> = {
        let mut v = Vec::new();
        for i in 0..zip.len() {
            if let Ok(f) = zip.by_index(i) {
                v.push(f.name().to_string());
            }
        }
        v
    };
    let mut count = 0usize;
    let mut loader_ok = false;
    for name in &names {
        let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
        if !base.to_ascii_lowercase().ends_with(".dll") {
            continue; // skip dirs / non-DLL payload
        }
        let is_loader = base.eq_ignore_ascii_case(LOADER_DLL);
        let dest = if is_loader { win64.join(base) } else { dlls_dir.join(base) };
        if extract_one(&mut zip, name, &dest)? {
            log.push(format!("Installed {base}{}", if is_loader { " (loader → Win64)" } else { "" }));
            count += 1;
            loader_ok |= is_loader;
        }
    }
    if !loader_ok {
        log.push(format!("WARNING: {LOADER_DLL} (loader) not found in package"));
    }
    log.push(format!("{count} DLL(s) installed"));

    // ef_server.txt from the package is deliberately NOT installed anymore —
    // the launcher provides the server via the environment.

    Ok(log)
}

