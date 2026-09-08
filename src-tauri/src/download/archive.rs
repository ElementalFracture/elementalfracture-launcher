//! Unpacking what `transfer` fetched: the zips the game ships in, and the one
//! tar the umu runtime ships in.

use super::progress::{emit, human};
use crate::error::{AppError, AppResult, ErrorCode};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::Instant;

/// Extract a zip preserving its directory structure.
/// Turn a zip entry name into a safe relative path under the install dir.
/// `enclosed_name()` returns None (and the old code SILENTLY skipped the file)
/// for anything it deems non-enclosed — a Windows-built archive entry, an odd
/// component, a leading slash — which is exactly how a "downloaded but broken"
/// install happens: a handful of assets/paks vanish with no error and the game
/// renders garbage. Here we sanitize instead of dropping: normalise backslashes,
/// clamp `..`, strip drive/empty components. Only a name that sanitises to
/// nothing returns None (a pure directory marker), never a real file.
fn safe_rel_path(name: &str) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for comp in name.replace('\\', "/").split('/') {
        match comp {
            "" | "." => continue,
            ".." => {
                out.pop();
            }
            c => {
                // Drop a bare Windows drive prefix ("C:") if it ever leads a name.
                if c.ends_with(':') && c.len() <= 2 {
                    continue;
                }
                out.push(c);
            }
        }
    }
    (!out.as_os_str().is_empty()).then_some(out)
}

/// Ceiling on what one archive may unpack to, declared or actual.
///
/// A zip's central directory states each entry's uncompressed size, and that
/// is what a decompression bomb inflates: a few KB on the wire promising
/// terabytes on disk. 64 GiB sits far above a real install (a few GB) and only
/// catches something that was never going to be legitimate.
///
/// One number for all three extractors. The patch and the playtest pak are
/// much smaller than a base install, so a tighter limit would be more
/// meaningful for them — but a single generous ceiling is the one that stops a
/// bomb without anyone having to revise it when a payload grows.
const MAX_UNCOMPRESSED: u64 = 64 * 1024 * 1024 * 1024; // 64 GiB

/// What the central directory says this archive unpacks to, refused if that is
/// past the ceiling.
fn declared_size(zip: &mut zip::ZipArchive<File>) -> AppResult<u64> {
    declared_size_within(zip, MAX_UNCOMPRESSED)
}

/// The body of `declared_size`, with the ceiling passed in so a test can hold
/// one against a small archive instead of needing a 64 GiB fixture.
///
/// `saturating_add` rather than `+`: a crafted zip can declare sizes that
/// overflow the running total and wrap around to something small, which is a
/// check that reports success on the worst input it could be given.
fn declared_size_within(zip: &mut zip::ZipArchive<File>, limit: u64) -> AppResult<u64> {
    let mut total: u64 = 0;
    for i in 0..zip.len() {
        total = total.saturating_add(zip.by_index(i)?.size());
    }
    if total > limit {
        return Err(AppError::new(ErrorCode::ArchiveTooLarge)
            .with("size", human(total))
            .with("limit", human(limit)));
    }
    Ok(total)
}

/// Take `n` bytes out of what this archive has left to spend.
///
/// The declared-size check above trusts the central directory, which is exactly
/// what a hostile archive writes. This is the half that doesn't: an entry that
/// declares 1 KB and then streams forever is stopped at the ceiling rather than
/// when the disk fills. The size it reports is a bound, not a total — the copy
/// stops before finding out how much more there was.
fn spend(budget: &mut u64, n: u64) -> AppResult<()> {
    *budget = budget.checked_sub(n).ok_or_else(|| {
        AppError::new(ErrorCode::ArchiveTooLarge)
            .with("size", format!("> {}", human(MAX_UNCOMPRESSED)))
            .with("limit", human(MAX_UNCOMPRESSED))
    })?;
    Ok(())
}

/// `std::io::copy` against that budget. Generic over the reader so it never has
/// to name the zip crate's entry type.
fn copy_within_budget<R: Read>(src: &mut R, out: &mut File, budget: &mut u64) -> AppResult<()> {
    let mut buf = vec![0u8; 1 << 20]; // 1 MiB
    loop {
        let n = src.read(&mut buf)?;
        if n == 0 {
            return Ok(());
        }
        spend(budget, n as u64)?;
        out.write_all(&buf[..n])?;
    }
}

pub(super) fn extract_all(app: &tauri::AppHandle, stage: &str, zip_path: &Path, dest: &Path) -> AppResult<()> {
    let file = File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let total = zip.len();

    // Total UNCOMPRESSED bytes, read from the central directory (no decompression).
    // Progress is driven by bytes, not file count: the archive ends with one huge
    // game pak, so a per-file bar hits ~99% and then sits frozen for minutes while
    // that last file copies. Byte progress (updated DURING the copy) moves smoothly.
    // The same pass refuses an archive that declares more than the ceiling, before
    // a single entry is written.
    let total_bytes = declared_size(&mut zip)?.max(1);
    // What the entries are actually allowed to stream, regardless of what they
    // declared above.
    let mut budget = MAX_UNCOMPRESSED;

    // Count files written vs. files the archive says it holds. A mismatch means
    // something was silently dropped (or the archive is truncated/corrupt); we
    // surface that as an error so the user retries a clean download instead of
    // launching a half-extracted, glitched install.
    let mut expected_files = 0usize;
    let mut written = 0usize;
    let mut bytes_done: u64 = 0;
    let mut buf = vec![0u8; 1 << 20]; // 1 MiB copy buffer
    let mut last = Instant::now();

    for i in 0..total {
        let mut entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        if entry.is_dir() {
            if let Some(rel) = safe_rel_path(&name) {
                fs::create_dir_all(dest.join(rel))?;
            }
            continue;
        }
        expected_files += 1;
        // A real file MUST resolve to a path — never silently skipped.
        let rel = safe_rel_path(&name)
            .ok_or_else(|| AppError::detail(ErrorCode::BadArchiveEntry, format!("{name:?}")))?;
        let out = dest.join(rel);
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut f = File::create(&out)?;
        // Copy in chunks and report progress DURING the file, so a multi-GB pak
        // shows a moving bar instead of looking hung on the final entry.
        loop {
            let n = entry.read(&mut buf)?;
            if n == 0 {
                break;
            }
            spend(&mut budget, n as u64)?;
            f.write_all(&buf[..n])?;
            bytes_done += n as u64;
            if last.elapsed().as_millis() >= 150 {
                emit(
                    app,
                    stage,
                    format!("{name}  ({} / {})", human(bytes_done), human(total_bytes)),
                    bytes_done as f64 / total_bytes as f64 * 100.0,
                    bytes_done,
                    total_bytes,
                );
                last = Instant::now();
            }
        }
        written += 1;
    }

    if written != expected_files {
        return Err(AppError::new(ErrorCode::ExtractionIncomplete)
            .with("written", written)
            .with("expected", expected_files));
    }
    emit(app, stage, format!("{written} files extracted"), 100.0, total_bytes, total_bytes);
    Ok(())
}

/// Extract every file of a zip flat into one directory (used for the balance
/// patch, whose paks belong directly in g3/Content/Paks).
pub(super) fn extract_flat(zip_path: &Path, dest: &Path) -> AppResult<Vec<String>> {
    let file = File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    declared_size(&mut zip)?;
    let mut budget = MAX_UNCOMPRESSED;
    let mut names = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let Some(rel) = entry.enclosed_name() else { continue };
        let Some(base) = rel.file_name() else { continue };
        let out = dest.join(base);
        let mut f = File::create(&out)?;
        copy_within_budget(&mut entry, &mut f, &mut budget)?;
        names.push(base.to_string_lossy().into_owned());
    }
    Ok(names)
}

/// Pull the pak/sig out of the playtest archive under the names the playtest
/// variant looks for, whatever they're called inside it. Returns what it
/// found, for the progress line.
pub(super) fn stage_test_pak(zip_path: &Path, paks: &Path) -> AppResult<String> {
    let file = File::open(zip_path)?;
    let mut zip = zip::ZipArchive::new(file)?;
    declared_size(&mut zip)?;
    let mut budget = MAX_UNCOMPRESSED;
    let mut pak = false;
    let mut sig = false;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let Some(rel) = entry.enclosed_name() else { continue };
        let Some(name) = rel
            .file_name()
            .and_then(|n| n.to_str())
            .map(str::to_ascii_lowercase)
        else {
            continue;
        };
        let dest = if name.ends_with(".pak") {
            pak = true;
            paks.join("ElefracTest_P.pak")
        } else if name.ends_with(".sig") {
            sig = true;
            paks.join("ElefracTest_P.sig")
        } else {
            continue;
        };
        let mut f = File::create(&dest)?;
        copy_within_budget(&mut entry, &mut f, &mut budget)?;
    }
    if !pak {
        return Err(AppError::new(ErrorCode::PlaytestArchiveEmpty));
    }
    Ok(if sig {
        "pak + sig".into()
    } else {
        "pak (unsigned)".into()
    })
}

/// Read a NUL-terminated field out of a tar header block.
fn tar_str(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).into_owned()
}

/// Parse a tar octal size field (space/NUL padded).
fn tar_octal(bytes: &[u8]) -> Option<u64> {
    let s = tar_str(bytes);
    let s = s.trim_matches(|c| c == ' ' || c == '\0');
    if s.is_empty() {
        return Some(0);
    }
    u64::from_str_radix(s, 8).ok()
}

/// Pull the single `umu-run` zipapp out of umu-launcher's (uncompressed) tar
/// release and write it to `dest`. The archive holds only `umu/umu-run` (the
/// python zipapp) and a `umu/umu_run.py` symlink to it, so we walk the plain
/// USTAR 512-byte headers and take the one regular file named `umu-run`. Kept
/// dependency-free (the zip crate can't read tar, and pulling in a tar crate
/// for two entries isn't worth it).
pub(super) fn extract_umu_run(tar_path: &Path, dest: &Path) -> AppResult<()> {
    let data = fs::read(tar_path)?;
    let mut off = 0usize;
    while off + 512 <= data.len() {
        let header = &data[off..off + 512];
        // Two consecutive zero blocks end the archive; one is enough to stop.
        if header.iter().all(|&b| b == 0) {
            break;
        }
        let name = tar_str(&header[0..100]);
        let size = tar_octal(&header[124..136])
            .ok_or_else(|| AppError::new(ErrorCode::RuntimeArchiveCorrupt))?;
        let typeflag = header[156];
        let data_start = off + 512;
        let data_end = data_start
            .checked_add(size as usize)
            .filter(|&e| e <= data.len())
            .ok_or_else(|| AppError::new(ErrorCode::RuntimeArchiveCorrupt))?;

        // Regular file ('0' or legacy NUL typeflag) whose basename is umu-run.
        let is_regular = typeflag == b'0' || typeflag == 0;
        let base = name.rsplit('/').next().unwrap_or(&name);
        if is_regular && base == "umu-run" {
            fs::write(dest, &data[data_start..data_end])?;
            return Ok(());
        }

        // Advance past this entry's data, padded up to the next 512 boundary.
        off = data_start + ((size as usize + 511) & !511);
    }
    Err(AppError::new(ErrorCode::RuntimeMissingUmu))
}

#[cfg(test)]
#[path = "__tests/archive.rs"]
mod tests;
