//! Checking an install that is ALREADY on disk against the release it came
//! from, and putting back whatever is missing or the wrong size.
//!
//! Everything this launcher downloads is already verified on the way in: the
//! payload's SHA-256 has to match the signed manifest (`manifest.rs`), and
//! every file it unpacks is read back and compared with the archive entry it
//! came from (`archive::unpack_verified`). What none of that covers is an
//! install that is already there. A folder unpacked by an older launcher that
//! had neither check, a half-finished update, a file antivirus took away
//! afterwards, a bad sector: nothing ever looks again, and the first the
//! player hears of it is the game refusing to start over one missing file.
//! That is what the reports of a missing `.sig` are — the install never had
//! it, and no amount of re-running the update gets it back, because the
//! update only ever touches the patch and the mods.
//!
//! So this compares the installed tree with the base archive's own central
//! directory, which is ~160 KB fetched by range request rather than the 22 GiB
//! the archive weighs. Presence and size, per entry: that is exactly what
//! catches a file that is gone or truncated, and it costs no bandwidth beyond
//! the directory itself. It is not a hash of every byte on disk; re-reading
//! 22 GiB to find a flipped bit is a different, much slower job, and not the
//! one anybody is asking for.
//!
//! A repair then fetches JUST the entries that are wrong, again by range, and
//! inflates them (`entry_bytes`). Replacing a 200-byte signature file costs a
//! few KB, not a re-download of the whole game. Each repaired entry's CRC-32
//! is checked against the central directory before it is written, so a repair
//! cannot itself install a bad file.

use super::archive::{entry_bytes, wrapper_prefix, ZipEntry};
use super::install::{apply_patch_for_repair, archive_source, remote_listing, BASE_ZIP};
use super::transfer::ArchiveSource;
use super::manifest::fetch_manifest;
use super::progress::emit;
use super::transfer::http;
use crate::error::{AppError, AppResult, ErrorCode};
use crate::{game, settings};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

/// What a verify pass found, and what it managed to do about it.
#[derive(Serialize, specta::Type, Default, Debug)]
pub struct VerifyReport {
    /// Entries in the base archive that were compared.
    pub checked: u32,
    pub missing: u32,
    pub wrong_size: u32,
    pub repaired: u32,
    /// Entry names that are still wrong after the repair ran (or that it was
    /// not asked to fix). Capped, so one badly broken install cannot return a
    /// list of ten thousand names to the UI.
    pub unresolved: Vec<String>,
    /// Nothing is wrong with the install any more.
    pub ok: bool,
}

/// How many unresolved names are worth reporting.
const SHOWN: usize = 20;

/// One file that does not match the archive.
struct Bad<'a> {
    entry: &'a ZipEntry,
    out: PathBuf,
    /// False when the file is there but the wrong size.
    absent: bool,
}

/// Compare the installed tree with the base archive and, when `repair`, put
/// back what is wrong.
///
/// Reports rather than throws for a bad install: "eleven files are missing" is
/// the answer, not an error. It only errors when it could not do the check at
/// all (no install, no manifest, a CDN that will not serve ranges).
#[tauri::command]
#[specta::specta]
pub async fn verify_game_files(app: tauri::AppHandle, repair: bool) -> AppResult<VerifyReport> {
    let s = settings::load(&app);
    if s.game_path.is_empty() {
        return Err(AppError::new(ErrorCode::NoGameFolder));
    }
    let root = PathBuf::from(&s.game_path);
    let cdn = s.cdn_base.trim_end_matches('/').to_string();
    let client = http()?;

    // The manifest is fetched for the same reason every other job fetches it:
    // a repair pulls bytes and writes them into the game folder, so the list
    // those bytes are checked against has to be the signed one. It also
    // refuses a rolled-back release before anything is compared.
    emit(&app, "verify-files", "Checking the release…".into(), 0.0, 0, 0);
    let manifest = fetch_manifest(&app, &client, &cdn).await?;
    let _ = manifest.hash_for(BASE_ZIP)?; // this release has a base archive at all

    // Through the parts when the release has them: a repair then costs edge-cached range reads instead
    // of origin reads of the 11 GB object (which, at hundreds a minute, took the CDN down).
    let src = archive_source(&cdn, &manifest);
    let url = src.url.clone();
    emit(&app, "verify-files", "Reading the file list…".into(), 0.0, 0, 0);
    let (_size, listing) = remote_listing(&client, &src)
        .await
        .ok_or_else(|| AppError::new(ErrorCode::ArchiveListingUnavailable).with("url", &url))?;

    let strip = wrapper_prefix(&listing);
    let mut report = VerifyReport::default();
    let mut bad: Vec<Bad> = Vec::new();
    for entry in &listing {
        let Some(rel) = super::archive::install_rel_path(&entry.name, strip.as_deref()) else {
            continue;
        };
        let out = root.join(rel);
        report.checked += 1;
        match fs::metadata(&out) {
            Err(_) => {
                report.missing += 1;
                bad.push(Bad { entry, out, absent: true });
            }
            Ok(m) if m.len() != entry.size => {
                report.wrong_size += 1;
                bad.push(Bad { entry, out, absent: false });
            }
            Ok(_) => {}
        }
    }

    if bad.is_empty() {
        report.ok = true;
        emit(&app, "verify-files", format!("{} files checked, all present", report.checked), 100.0, 0, 0);
        return Ok(report);
    }

    let found = format!(
        "{} missing, {} the wrong size",
        report.missing, report.wrong_size
    );
    if !repair {
        report.unresolved = bad.iter().take(SHOWN).map(|b| b.entry.name.clone()).collect();
        emit(&app, "verify-files", format!("{found} — repair not run"), 100.0, 0, 0);
        return Ok(report);
    }

    // Repair, entry by entry, cheapest first so the small files everything
    // actually trips over (a signature, a config) are back before a multi-GB
    // pak starts. An entry that will not come down does not stop the rest.
    bad.sort_by_key(|b| b.entry.compressed);
    let total = bad.len() as u64;
    for (i, b) in bad.iter().enumerate() {
        emit(
            &app,
            "verify-files",
            format!("Restoring {}", b.entry.name),
            i as f64 / total.max(1) as f64 * 100.0,
            i as u64,
            total,
        );
        match restore(&client, &src, b).await {
            Ok(()) => report.repaired += 1,
            Err(e) => {
                log_repair_failure(&b.entry.name, &e);
                if report.unresolved.len() < SHOWN {
                    report.unresolved.push(b.entry.name.clone());
                }
            }
        }
    }

    // The base tree is the archive's again. The patch and the mod package sit
    // on top of it and have their own files (the balance pak and ITS
    // signature among them), so bring those level too rather than leaving an
    // install that is half repaired. This is variant-aware: it re-applies the
    // layout the player is actually on.
    if let Err(e) = apply_patch_for_repair(&app, &cdn, &root, &manifest).await {
        log_repair_failure("patch", &e);
        if report.unresolved.len() < SHOWN {
            report.unresolved.push("balance patch".into());
        }
    }

    report.ok = report.unresolved.is_empty();
    let done = format!("{found}; {} restored", report.repaired);
    emit(&app, "verify-files", done, 100.0, total, total);
    Ok(report)
}

fn log_repair_failure(name: &str, e: &AppError) {
    emit_log(format!("verify: could not restore {name}: {e:?}"));
}

fn emit_log(line: String) {
    // The launcher has no file log of its own; stderr is what the packaging
    // scripts capture when a player sends a report.
    eprintln!("{line}");
}

/// Fetch one entry out of the remote archive and write it where it belongs.
async fn restore(client: &reqwest::Client, src: &ArchiveSource, b: &Bad<'_>) -> AppResult<()> {
    let bytes = entry_bytes(client, src, b.entry).await?;
    if let Some(dir) = b.out.parent() {
        fs::create_dir_all(dir)?;
    }
    // Write beside the target and rename, so a failure part-way through leaves
    // the old file rather than a half-written new one. A file that was merely
    // the wrong size is replaced the same way as one that was absent.
    let tmp = b.out.with_extension("ef-restore");
    fs::write(&tmp, &bytes)?;
    if !b.absent {
        let _ = fs::remove_file(&b.out);
    }
    fs::rename(&tmp, &b.out).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AppError::detail(ErrorCode::ExtractionMismatch, e).with("file", b.entry.name.clone())
    })?;
    Ok(())
}

/// A cheap, offline look at whether the install is missing a pak's signature.
///
/// A signed pak whose `.sig` is gone is not mountable, and the game says so in
/// its own words on a black screen rather than the launcher's. Checked here,
/// before launch, it becomes "run Verify game files" instead. Local and
/// instant: the real check above costs two range requests, and putting the CDN
/// between a player and their game on every launch is not worth it.
///
/// Only pairs are judged. A pak with no signature beside it is normal for an
/// unsigned mod pak, so this looks for a `.sig` whose `.pak` is there and vice
/// versa only among the paks that shipped signed.
pub fn unmountable_pak(root: &Path) -> Option<String> {
    let paks = game::paks_dir(root);
    let entries = fs::read_dir(&paks).ok()?;
    let mut seen: Vec<(String, bool, bool)> = Vec::new();
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let (stem, is_sig) = match name.rsplit_once('.') {
            Some((stem, ext)) if ext.eq_ignore_ascii_case("sig") => (stem.to_string(), true),
            Some((stem, ext)) if ext.eq_ignore_ascii_case("pak") => (stem.to_string(), false),
            _ => continue,
        };
        match seen.iter_mut().find(|(s, _, _)| *s == stem) {
            Some(row) => {
                if is_sig { row.1 = true } else { row.2 = true }
            }
            None => seen.push((stem, is_sig, !is_sig)),
        }
    }
    // A .sig with no .pak is litter, not a broken mount. A .pak whose .sig
    // went missing is the failure being reported -- but only for the paks that
    // ship signed, which is the base archive's and the balance pak.
    const SIGNED: &[&str] = &["g3-WindowsNoEditor", "ElefracBalance_P", "ElefracTest_P"];
    seen.into_iter()
        .find(|(stem, has_sig, has_pak)| *has_pak && !*has_sig && SIGNED.contains(&stem.as_str()))
        .map(|(stem, _, _)| format!("{stem}.sig"))
}
