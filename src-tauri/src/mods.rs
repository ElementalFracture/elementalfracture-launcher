use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;
use serde::Serialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

// The loader is the one DLL that goes into the game's Win64 binary folder (the
// game imports it at startup); every OTHER *.dll in mod.zip goes into Mods/dlls.
// Nothing is hardcoded beyond this rule, so a new mod ships just by being in the zip.
pub const LOADER_DLL: &str = "xinput1_3.dll";

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

/// The CDN path of the mod package, and its key in the signed manifest.
pub const MOD_ZIP: &str = "patch/mod/mod.zip";

/// Download mod.zip from the CDN and install it into the game folder.
/// Port of install.bat: purge old Mods/dlls/*.dll, drop the loader into
/// g3/Binaries/Win64, copy the mod DLLs. Shared by the Mods-view button
/// and the install/update pipeline (patch → mods → version bump).
///
/// `sha256` is the manifest's entry for the package; nothing is written into
/// the game folder unless the bytes hash to it.
pub async fn fetch_and_install(cdn_base: &str, root: PathBuf, sha256: &str) -> AppResult<Vec<String>> {
    if !win64_dir(&root).is_dir() {
        return Err(AppError::new(ErrorCode::NotSpellbreakInstall));
    }

    let url = format!("{}/{MOD_ZIP}", cdn_base.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        // Timeout after 15s if no connexion established
        .connect_timeout(std::time::Duration::from_secs(15))
        // Timeout if no byte received after 1min.
        .read_timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))?;
    if bytes.len() < 1024 {
        return Err(AppError::new(ErrorCode::ModArchiveTooSmall));
    }
    let actual = crate::download::manifest::sha256_hex(&bytes);
    if actual != sha256.to_ascii_lowercase() {
        return Err(AppError::new(ErrorCode::DownloadHashMismatch)
            .with("file", "mod.zip")
            .with("expected", sha256)
            .with("actual", actual));
    }

    tauri::async_runtime::spawn_blocking(move || install_from_zip(&root, &bytes))
        .await
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))?
}

#[tauri::command]
#[specta::specta]
pub async fn install_mods(app: tauri::AppHandle) -> AppResult<Vec<String>> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::detail(ErrorCode::ModDownloadFailed, e))?;
    let manifest = crate::download::manifest::fetch_manifest(&app, &client, &cdn).await?;
    fetch_and_install(&cdn, PathBuf::from(&s.game_path), manifest.hash_for(MOD_ZIP)?).await
}

fn extract_one(
    zip: &mut zip::ZipArchive<Cursor<&[u8]>>,
    name: &str,
    dest: &Path,
) -> AppResult<bool> {
    match zip.by_name(name) {
        Ok(mut f) => {
            let mut buf = Vec::with_capacity(f.size() as usize);
            std::io::copy(&mut f, &mut buf)?;
            fs::write(dest, buf)?;
            Ok(true)
        }
        Err(zip::result::ZipError::FileNotFound) => Ok(false),
        Err(e) => Err(e.into()),
    }
}

fn install_from_zip(root: &Path, bytes: &[u8]) -> AppResult<Vec<String>> {
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes))?;
    let mut log = Vec::new();

    let dlls_dir = root.join("Mods").join("dlls");
    let cmds_dir = root.join("Mods").join("commands");
    fs::create_dir_all(&dlls_dir)?;
    fs::create_dir_all(&cmds_dir)?;

    // Perpetual paks bundled in mod.zip (e.g. EFCrouch_P.pak + its .sig) install
    // into g3/Content/Paks and stay put: the version swapper (game.rs) only ever
    // parks/activates ElefracBalance/ElefracTest, and the purge above only removes
    // Mods/dlls/*.dll, so these are never touched across Classic/EF/Playtest switches.
    let paks = crate::game::paks_dir(root);
    fs::create_dir_all(&paks)?;

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
    // Same for the `.ef_auth` marker that succeeded them: the game reads the
    // session key from its environment now, so a copy in the game folder is
    // only a plaintext credential sitting on a possibly-shared drive.
    if fs::remove_file(root.join(".ef_auth")).is_ok() {
        log.push("Removed legacy .ef_auth".into());
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
    let mut pak_count = 0usize;
    let mut loader_ok = false;
    for name in &names {
        let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
        let lower = base.to_ascii_lowercase();
        let is_dll = lower.ends_with(".dll");
        let is_pak = lower.ends_with(".pak") || lower.ends_with(".sig");
        if !is_dll && !is_pak {
            continue; // skip dirs / other payload
        }
        let is_loader = is_dll && base.eq_ignore_ascii_case(LOADER_DLL);
        let dest = if is_loader {
            win64.join(base)
        } else if is_dll {
            dlls_dir.join(base)
        } else {
            paks.join(base) // perpetual pak/sig → g3/Content/Paks
        };
        if extract_one(&mut zip, name, &dest)? {
            if is_dll {
                log.push(format!("Installed {base}{}", if is_loader { " (loader → Win64)" } else { "" }));
                count += 1;
                loader_ok |= is_loader;
            } else {
                log.push(format!("Installed {base} (pak → Content/Paks)"));
                pak_count += 1;
            }
        }
    }
    if !loader_ok {
        log.push(format!("WARNING: {LOADER_DLL} (loader) not found in package"));
    }
    log.push(format!("{count} DLL(s) installed"));
    if pak_count > 0 {
        log.push(format!("{pak_count} pak file(s) installed"));
    }

    // ef_server.txt from the package is deliberately NOT installed anymore —
    // the launcher provides the server via the environment.

    Ok(log)
}

#[cfg(test)]
#[path = "__tests/mods.rs"]
mod tests;
