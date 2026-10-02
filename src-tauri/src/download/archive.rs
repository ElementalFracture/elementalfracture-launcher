//! Unpacking what `transfer` fetched: the zips the game ships in, and the one
//! tar the umu runtime ships in.
//!
//! Every zip goes through `unpack_verified`: write each entry, then read every
//! written file back and compare it byte for byte with the entry it came from,
//! writing again whatever doesn't match. A job reports success only once the
//! folder on disk is the archive's contents.

use super::progress::{emit, human};
use crate::error::{AppError, AppResult, ErrorCode};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, Read, Seek, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

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
/// terabytes on disk. 64 GiB sits far above a real install (~23 GiB) and only
/// catches something that was never going to be legitimate.
///
/// One number for all three extractors. The patch and the playtest pak are
/// much smaller than a base install, so a tighter limit would be more
/// meaningful for them — but a single generous ceiling is the one that stops a
/// bomb without anyone having to revise it when a payload grows.
const MAX_UNCOMPRESSED: u64 = 64 * 1024 * 1024 * 1024; // 64 GiB

/// What the central directory says this archive unpacks to, refused if that is
/// past the ceiling.
fn declared_size<R: Read + Seek>(zip: &mut zip::ZipArchive<R>) -> AppResult<u64> {
    declared_size_within(zip, MAX_UNCOMPRESSED)
}

/// The body of `declared_size`, with the ceiling passed in so a test can hold
/// one against a small archive instead of needing a 64 GiB fixture.
///
/// `saturating_add` rather than `+`: a crafted zip can declare sizes that
/// overflow the running total and wrap around to something small, which is a
/// check that reports success on the worst input it could be given.
fn declared_size_within<R: Read + Seek>(zip: &mut zip::ZipArchive<R>, limit: u64) -> AppResult<u64> {
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

/// One file an archive puts on disk: the entry it comes from and where it lands.
struct Target {
    index: usize,
    /// The entry's name inside the archive, for progress lines and errors.
    name: String,
    out: PathBuf,
    size: u64,
    crc: u32,
}

/// Refuse two entries that land on the same file with different contents, and
/// collapse ones that are the same file twice.
///
/// Compared case-insensitively on every platform: the game runs on NTFS or
/// under Proton, both of which look `Foo.pak` and `foo.pak` up as one file.
/// Left alone, the second entry overwrites the first and the read-back can
/// only ever find one of them right — re-extracting would just trade which.
fn one_entry_per_file(targets: Vec<Target>) -> AppResult<Vec<Target>> {
    let mut seen: HashMap<String, usize> = HashMap::new();
    let mut kept: Vec<Target> = Vec::with_capacity(targets.len());
    for t in targets {
        let key = t.out.to_string_lossy().to_lowercase();
        match seen.get(&key) {
            Some(&i) if kept[i].size == t.size && kept[i].crc == t.crc => {}
            Some(&i) => {
                return Err(AppError::detail(
                    ErrorCode::BadArchiveEntry,
                    format!("{:?} and {:?} unpack to the same file", kept[i].name, t.name),
                ))
            }
            None => {
                seen.insert(key, kept.len());
                kept.push(t);
            }
        }
    }
    Ok(kept)
}

/// Which pass of `unpack_verified` a progress report comes from.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Pass {
    Write,
    Verify,
    /// Writing again the files the read-back found wrong.
    Repair,
}

/// `(pass, entry name, bytes done, bytes in this pass)`, called as bytes move.
type Report<'a> = &'a mut dyn FnMut(Pass, &str, u64, u64);

/// How many times the read-back may send files to be written again before the
/// job gives up on them.
const REPAIR_ROUNDS: usize = 3;

/// Tries at one file before an error writing it is final.
const ATTEMPTS: u32 = 5;

/// Put every target on disk, then read each one back and compare it byte for
/// byte with what its entry unpacks to, writing again whatever doesn't match.
///
/// The archive itself is already trusted by now (its SHA-256 is in the signed
/// manifest, and the zip crate checks each entry's CRC as it decompresses), so
/// what this catches is everything between the decompressor and the disk: a
/// file antivirus quarantined or rewrote after it landed, a write the OS
/// accepted and then lost, an earlier install's file the job never managed to
/// replace. Returns Ok only when every file on disk is the archive's.
fn unpack_verified<R: Read + Seek>(zip: &mut zip::ZipArchive<R>, targets: &[Target], report: Report) -> AppResult<()> {
    let all: Vec<&Target> = targets.iter().collect();
    write_targets(zip, &all, Pass::Write, report)?;
    let mut bad = mismatched(zip, &all, report)?;
    let mut round = 0;
    while !bad.is_empty() {
        if round == REPAIR_ROUNDS {
            return Err(mismatch_error(&bad));
        }
        round += 1;
        write_targets(zip, &bad, Pass::Repair, report)?;
        bad = mismatched(zip, &bad, report)?;
    }
    Ok(())
}

fn mismatch_error(bad: &[&Target]) -> AppError {
    const SHOWN: usize = 5;
    let mut files = bad
        .iter()
        .take(SHOWN)
        .map(|t| t.name.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    if bad.len() > SHOWN {
        files.push_str(", …");
    }
    AppError::new(ErrorCode::ExtractionMismatch)
        .with("count", bad.len())
        .with("files", files)
}

fn write_targets<R: Read + Seek>(zip: &mut zip::ZipArchive<R>, targets: &[&Target], pass: Pass, report: Report) -> AppResult<()> {
    let total: u64 = targets.iter().map(|t| t.size).sum();
    // Each pass gets the whole ceiling: a repair re-writes files the first
    // pass already spent on, and that is not the archive growing.
    let mut budget = MAX_UNCOMPRESSED;
    let mut buf = vec![0u8; 1 << 20]; // 1 MiB
    let mut done = 0u64;
    for t in targets {
        write_target(zip, t, &mut budget, &mut buf, &mut |n| report(pass, &t.name, done + n, total))?;
        done += t.size;
    }
    Ok(())
}

/// Why one attempt at writing a file stopped, and whether another might not.
enum Failed {
    Retry(AppError),
    Final(AppError),
}

/// Whether an I/O error is worth another go. On Windows, antivirus and the
/// search indexer open freshly written files to scan them, and for that moment
/// anything else touching the file is refused — a sharing or lock violation
/// (32/33), or a bare access-denied, which std reports as PermissionDenied.
/// They clear on their own within a second or two.
fn transient(e: &io::Error) -> bool {
    use io::ErrorKind::*;
    matches!(e.kind(), Interrupted | WouldBlock | TimedOut | PermissionDenied)
        || (cfg!(windows) && matches!(e.raw_os_error(), Some(32 | 33)))
}

/// `write_once`, again after a pause while the failure looks like it might pass.
fn write_target<R: Read + Seek>(
    zip: &mut zip::ZipArchive<R>,
    t: &Target,
    budget: &mut u64,
    buf: &mut [u8],
    progress: &mut dyn FnMut(u64),
) -> AppResult<()> {
    let mut attempt = 1;
    loop {
        let before = *budget;
        match write_once(zip, t, budget, buf, progress) {
            Ok(()) => return Ok(()),
            Err(Failed::Retry(_)) if attempt < ATTEMPTS => {
                // What the failed attempt streamed never reached the disk
                // for good, so it doesn't count against the ceiling.
                *budget = before;
                std::thread::sleep(Duration::from_millis(250 << attempt)); // 0.5s … 4s
                attempt += 1;
            }
            Err(Failed::Retry(e) | Failed::Final(e)) => return Err(e),
        }
    }
}

fn write_once<R: Read + Seek>(
    zip: &mut zip::ZipArchive<R>,
    t: &Target,
    budget: &mut u64,
    buf: &mut [u8],
    progress: &mut dyn FnMut(u64),
) -> Result<(), Failed> {
    let disk = |e: io::Error| {
        let err = AppError::detail(ErrorCode::Io, format!("{}: {e}", t.out.display()));
        if transient(&e) {
            Failed::Retry(err)
        } else {
            Failed::Final(err)
        }
    };
    if let Some(parent) = t.out.parent() {
        fs::create_dir_all(parent).map_err(disk)?;
    }
    clear_target(&t.out).map_err(disk)?;

    let mut entry = zip.by_index(t.index).map_err(|e| Failed::Final(e.into()))?;
    let mut f = File::create(&t.out).map_err(disk)?;
    let mut written = 0u64;
    loop {
        let n = match entry.read(buf) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
            // The archive hashed right when it was downloaded, so a read that
            // fails now (a CRC mismatch included) is the disk or memory under
            // it having a bad moment — worth reading again.
            Err(e) => {
                return Err(Failed::Retry(AppError::detail(
                    ErrorCode::BadArchive,
                    format!("{}: {e}", t.name),
                )))
            }
        };
        spend(budget, n as u64).map_err(Failed::Final)?;
        f.write_all(&buf[..n]).map_err(disk)?;
        written += n as u64;
        progress(written);
    }
    // On the disk, not just in the page cache: a crash or power cut straight
    // after "Installation complete" must not be able to take a file back.
    f.sync_all().map_err(disk)
}

/// Get whatever is at `out` out of the way before writing it afresh.
///
/// Removed rather than truncated: a file an earlier install (or whatever
/// copied it there) left read-only can't be opened for writing on any
/// platform, and on Windows can't be deleted either until the attribute is
/// cleared.
fn clear_target(out: &Path) -> io::Result<()> {
    #[cfg(windows)]
    if let Ok(meta) = fs::symlink_metadata(out) {
        let mut perms = meta.permissions();
        if perms.readonly() {
            // On Windows this clears FILE_ATTRIBUTE_READONLY and nothing else;
            // the lint is about the Unix meaning (world-writable).
            #[allow(clippy::permissions_set_readonly_false)]
            perms.set_readonly(false);
            fs::set_permissions(out, perms)?;
        }
    }
    match fs::remove_file(out) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        r => r,
    }
}

/// The targets whose file on disk is not byte for byte what their entry
/// unpacks to.
fn mismatched<'a, R: Read + Seek>(zip: &mut zip::ZipArchive<R>, targets: &[&'a Target], report: Report) -> AppResult<Vec<&'a Target>> {
    let total: u64 = targets.iter().map(|t| t.size).sum();
    let mut want = vec![0u8; 1 << 20];
    let mut got = vec![0u8; 1 << 20];
    let mut done = 0u64;
    let mut bad = Vec::new();
    for &t in targets {
        let same = matches_entry(zip, t, &mut want, &mut got, &mut |n| {
            report(Pass::Verify, &t.name, done + n, total)
        })?;
        if !same {
            bad.push(t);
        }
        done += t.size;
    }
    Ok(bad)
}

/// Whether the file at `t.out` holds exactly the bytes entry `t.index` unpacks
/// to. Anything that stops the file being read — gone, locked, a directory,
/// the wrong length — is a no, and gets it written again. Only the archive
/// failing to read is an error.
fn matches_entry<R: Read + Seek>(
    zip: &mut zip::ZipArchive<R>,
    t: &Target,
    want: &mut [u8],
    got: &mut [u8],
    progress: &mut dyn FnMut(u64),
) -> AppResult<bool> {
    let Ok(mut file) = File::open(&t.out) else {
        return Ok(false);
    };
    match file.metadata() {
        Ok(m) if m.is_file() && m.len() == t.size => {}
        _ => return Ok(false),
    }
    let mut entry = zip.by_index(t.index)?;
    let mut checked = 0u64;
    loop {
        let n = fill(&mut entry, want).map_err(|e| AppError::detail(ErrorCode::BadArchive, format!("{}: {e}", t.name)))?;
        if n == 0 {
            break;
        }
        if file.read_exact(&mut got[..n]).is_err() || want[..n] != got[..n] {
            return Ok(false);
        }
        checked += n as u64;
        progress(checked);
    }
    // Nothing past the end of the entry either: a file that grew since the
    // length check is still wrong.
    Ok(matches!(file.read(&mut got[..1]), Ok(0)))
}

/// Read until `buf` is full or the reader is done — a decompressor hands back
/// whatever it has, which is rarely a whole buffer. The zip crate checks an
/// entry's CRC on the read that finds its end, which a caller looping until
/// this returns 0 always makes.
fn fill<R: Read>(r: &mut R, buf: &mut [u8]) -> io::Result<usize> {
    let mut n = 0;
    while n < buf.len() {
        match r.read(&mut buf[n..]) {
            Ok(0) => break,
            Ok(k) => n += k,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(e),
        }
    }
    Ok(n)
}

/// Every file entry of a zip, at its path under `dest`. Directory entries are
/// created here and now — an empty directory has nothing to verify.
fn plan_tree<R: Read + Seek>(zip: &mut zip::ZipArchive<R>, dest: &Path) -> AppResult<Vec<Target>> {
    let mut targets = Vec::new();
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        let name = entry.name().to_string();
        if entry.is_dir() {
            if let Some(rel) = safe_rel_path(&name) {
                fs::create_dir_all(dest.join(rel))?;
            }
            continue;
        }
        // A real file MUST resolve to a path — never silently skipped.
        let rel = safe_rel_path(&name)
            .ok_or_else(|| AppError::detail(ErrorCode::BadArchiveEntry, format!("{name:?}")))?;
        targets.push(Target {
            index: i,
            out: dest.join(rel),
            size: entry.size(),
            crc: entry.crc32(),
            name,
        });
    }
    one_entry_per_file(targets)
}

/// Extract a zip preserving its directory structure, and don't return until
/// every file on disk has been read back and matched (see `unpack_verified`).
/// Writing reports under `stage`, the read-back under `verify_stage`.
pub(super) fn extract_all(
    app: &tauri::AppHandle,
    stage: &str,
    verify_stage: &str,
    zip_path: &Path,
    dest: &Path,
) -> AppResult<()> {
    let mut zip = zip::ZipArchive::new(File::open(zip_path)?)?;
    // Refuses an archive that declares more than the ceiling, before a single
    // entry is written.
    declared_size(&mut zip)?;
    let targets = plan_tree(&mut zip, dest)?;
    // Checked before the download too (install.rs), against the archive's
    // listing; this is the exact figure, now that the archive is here.
    ensure_room(dest, bytes_to_add(targets.iter().map(|t| (t.out.clone(), t.size))))?;

    // Progress is driven by bytes, not file count: the archive ends with one
    // 22 GiB pak, so a per-file bar would sit frozen at ~99% for minutes.
    let mut last = Instant::now();
    let mut report = |pass: Pass, name: &str, done: u64, total: u64| {
        if last.elapsed().as_millis() < 150 {
            return;
        }
        last = Instant::now();
        let (stage, what) = match pass {
            Pass::Write => (stage, name.to_string()),
            Pass::Verify => (verify_stage, name.to_string()),
            Pass::Repair => (stage, format!("Re-extracting {name}")),
        };
        emit(
            app,
            stage,
            format!("{what}  ({} / {})", human(done), human(total)),
            done as f64 / total.max(1) as f64 * 100.0,
            done,
            total,
        );
    };
    unpack_verified(&mut zip, &targets, &mut report)?;

    let total: u64 = targets.iter().map(|t| t.size).sum();
    emit(app, verify_stage, format!("{} files extracted and verified", targets.len()), 100.0, total, total);
    Ok(())
}

/// Extract every file of a zip flat into one directory (used for the balance
/// patch, whose paks belong directly in g3/Content/Paks).
pub(super) fn extract_flat(zip_path: &Path, dest: &Path) -> AppResult<Vec<String>> {
    let mut zip = zip::ZipArchive::new(File::open(zip_path)?)?;
    declared_size(&mut zip)?;
    let mut targets = Vec::new();
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        let base = safe_rel_path(&name)
            .and_then(|rel| rel.file_name().map(PathBuf::from))
            .ok_or_else(|| AppError::detail(ErrorCode::BadArchiveEntry, format!("{name:?}")))?;
        targets.push(Target {
            index: i,
            out: dest.join(base),
            size: entry.size(),
            crc: entry.crc32(),
            name,
        });
    }
    let targets = one_entry_per_file(targets)?;
    unpack_verified(&mut zip, &targets, &mut |_, _, _, _| {})?;
    Ok(targets
        .iter()
        .filter_map(|t| t.out.file_name())
        .map(|n| n.to_string_lossy().into_owned())
        .collect())
}

/// Pull the pak/sig out of the playtest archive under the names the playtest
/// variant looks for. If the archive has a single unnamed pak, it is staged as
/// ElefracTest_P.pak; if it contains multiple paks or explicit filenames (e.g.
/// ElefracTest_P.pak, ElefracTestRegistry_P.pak), each unpacks to its own file.
pub(super) fn stage_test_pak(zip_path: &Path, paks: &Path) -> AppResult<String> {
    let mut zip = zip::ZipArchive::new(File::open(zip_path)?)?;
    declared_size(&mut zip)?;

    // Check if the archive contains an explicit ElefracTest_P.pak or multiple paks.
    // If there is only one pak and it is named something else (legacy single-pak archive),
    // rename it to ElefracTest_P.pak for backwards compatibility.
    let mut pak_count = 0usize;
    let mut has_explicit_test_pak = false;
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let lower = entry.name().to_ascii_lowercase();
        if lower.ends_with(".pak") {
            pak_count += 1;
            let base = safe_rel_path(entry.name())
                .and_then(|rel| rel.file_name().map(|n| n.to_string_lossy().to_ascii_lowercase()))
                .unwrap_or_default();
            if base == "elefractest_p.pak" {
                has_explicit_test_pak = true;
            }
        }
    }

    let rename_single_pak = pak_count == 1 && !has_explicit_test_pak;

    let mut targets = Vec::new();
    for i in 0..zip.len() {
        let entry = zip.by_index(i)?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().to_string();
        let lower = name.to_ascii_lowercase();
        let is_pak = lower.ends_with(".pak");
        let is_sig = lower.ends_with(".sig");
        if !is_pak && !is_sig {
            continue;
        }

        let out = if rename_single_pak {
            if is_pak {
                paks.join("ElefracTest_P.pak")
            } else {
                paks.join("ElefracTest_P.sig")
            }
        } else {
            let base = safe_rel_path(&name)
                .and_then(|rel| rel.file_name().map(PathBuf::from))
                .ok_or_else(|| AppError::detail(ErrorCode::BadArchiveEntry, format!("{name:?}")))?;
            paks.join(base)
        };

        targets.push(Target {
            index: i,
            out,
            size: entry.size(),
            crc: entry.crc32(),
            name,
        });
    }
    let targets = one_entry_per_file(targets)?;
    let has = |ext: &str| targets.iter().any(|t| t.out.extension().is_some_and(|e| e.eq_ignore_ascii_case(ext)));
    let (pak, sig) = (has("pak"), has("sig"));
    if !pak {
        return Err(AppError::new(ErrorCode::PlaytestArchiveEmpty));
    }
    unpack_verified(&mut zip, &targets, &mut |_, _, _, _| {})?;
    Ok(if sig {
        if targets.len() > 2 {
            format!("{} files", targets.len())
        } else {
            "pak + sig".into()
        }
    } else {
        "pak (unsigned)".into()
    })
}

/// Unpack the chosen entries of an archive to the chosen paths, written and
/// verified like every other job here. For callers that decide per entry
/// where it goes (mods.rs); `placements` is `(entry index, path)`.
pub(crate) fn extract_entries<R: Read + Seek>(
    zip: &mut zip::ZipArchive<R>,
    placements: Vec<(usize, PathBuf)>,
) -> AppResult<()> {
    declared_size(zip)?;
    let mut targets = Vec::with_capacity(placements.len());
    for (index, out) in placements {
        let entry = zip.by_index(index)?;
        targets.push(Target {
            index,
            name: entry.name().to_string(),
            out,
            size: entry.size(),
            crc: entry.crc32(),
        });
    }
    let targets = one_entry_per_file(targets)?;
    unpack_verified(zip, &targets, &mut |_, _, _, _| {})
}

/// Room kept free beyond what the files themselves take: directory entries,
/// cluster slack across a thousand-odd files, and the rest of the system
/// still needing to write somewhere while the game unpacks.
const HEADROOM: u64 = 512 * 1024 * 1024; // 512 MiB

/// What writing `files` (`(path, size)`) adds to the disk. A file already at a
/// path gives its space back when it is replaced (`clear_target` removes it
/// first), so an install over an earlier one needs far less than a fresh one.
fn bytes_to_add(files: impl IntoIterator<Item = (PathBuf, u64)>) -> u64 {
    files
        .into_iter()
        .map(|(path, size)| {
            let there = fs::metadata(&path).ok().filter(|m| m.is_file()).map_or(0, |m| m.len());
            size.saturating_sub(there)
        })
        .fold(0u64, u64::saturating_add)
}

/// Refuse to start what won't fit on the drive holding `dir`.
///
/// Best-effort in one direction only: if the free space can't be read, the
/// job goes ahead and a full disk is reported by the write that hits it.
pub(super) fn ensure_room(dir: &Path, need: u64) -> AppResult<()> {
    let need = need.saturating_add(HEADROOM);
    let Ok(free) = crate::platform::free_space(dir) else {
        return Ok(());
    };
    if free < need {
        return Err(AppError::new(ErrorCode::NotEnoughSpace)
            .with("need", human(need))
            .with("free", human(free))
            .with("path", dir.display()));
    }
    Ok(())
}

/// What unpacking `listing` (entry name, uncompressed size) into `dest` adds
/// to the disk, with the same name handling the unpack itself uses.
pub(super) fn bytes_to_unpack(listing: &[ZipEntry], dest: &Path) -> u64 {
    bytes_to_add(
        listing
            .iter()
            .filter_map(|e| safe_rel_path(&e.name).map(|rel| (dest.join(rel), e.size))),
    )
}

/// One file entry as the central directory describes it.
///
/// Enough to check an installed file against the archive without downloading
/// it (`name`, `size`), and enough to fetch that one entry back out of the
/// remote archive by byte range and inflate it (`offset`, `compressed`,
/// `method`, `crc`) instead of pulling 22 GiB to replace a 200-byte file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ZipEntry {
    pub name: String,
    pub size: u64,
    pub compressed: u64,
    pub crc: u32,
    /// 0 = stored, 8 = deflate. Anything else this launcher will not repair.
    pub method: u16,
    /// Where the entry's LOCAL header starts in the archive. The local header
    /// is variable length, so a fetch has to read it to find the data.
    pub offset: u64,
}

/// The single leading directory every entry shares, when the archive wraps
/// its contents in one (`SpellbreakBuild/g3/...` rather than `g3/...`).
///
/// `download_game` already copes with both shapes by looking for the folder
/// that contains `g3` after unpacking. A check that runs later has to make
/// the same decision from the listing alone, or it compares `<root>/g3/x`
/// against an entry named `wrapper/g3/x` and calls a perfectly good install
/// completely missing.
pub(super) fn wrapper_prefix(listing: &[ZipEntry]) -> Option<String> {
    let first = |name: &str| name.replace('\\', "/").split('/').next().unwrap_or("").to_string();
    let mut shared: Option<String> = None;
    for e in listing {
        let head = first(&e.name);
        if head.is_empty() {
            return None;
        }
        match &shared {
            Some(s) if *s != head => return None,
            Some(_) => {}
            None => shared = Some(head),
        }
    }
    // A shared head that IS a real top level of the game is not a wrapper.
    shared.filter(|s| !s.eq_ignore_ascii_case("g3") && !s.eq_ignore_ascii_case("Engine"))
}

/// Where an archive entry belongs under the install root, with the archive's
/// wrapper directory (if it has one) taken off.
pub(super) fn install_rel_path(name: &str, strip: Option<&str>) -> Option<PathBuf> {
    let rel = safe_rel_path(name)?;
    match strip {
        Some(w) => {
            let mut parts = rel.components();
            let head = parts.next()?;
            if head.as_os_str().eq_ignore_ascii_case(w) {
                let rest: PathBuf = parts.collect();
                (!rest.as_os_str().is_empty()).then_some(rest)
            } else {
                Some(rel)
            }
        }
        None => Some(rel),
    }
}

/// Fetch ONE entry out of a remote zip by byte range and return its contents.
///
/// The central directory gave us where the entry's local header starts and how
/// many compressed bytes follow it, so the whole cost of putting back a
/// missing file is that file, not the archive. The local header is variable
/// length (its name and extra field), so the request covers it plus a slack
/// and the header is parsed out of the front; a header longer than the slack
/// gets a second, exact request rather than a wrong answer.
///
/// The CRC-32 in the central directory is checked against what came out. That
/// is the same guarantee the normal unpack path gets from the zip crate, and
/// it is what stops a repair from writing a corrupt file over a merely
/// missing one.
pub(super) async fn entry_bytes(
    client: &reqwest::Client,
    src: &super::transfer::ArchiveSource,
    entry: &ZipEntry,
) -> AppResult<Vec<u8>> {
    const LOCAL_HEADER: u64 = 30;
    const SLACK: u64 = 8 * 1024;
    let url = src.url.as_str();

    let fetch = |from: u64, len: u64| async move {
        src.bytes(client, from, len).await.ok_or_else(|| {
            AppError::new(ErrorCode::ArchiveListingUnavailable)
                .with("url", url)
                .with("file", entry.name.clone())
        })
    };

    let want = LOCAL_HEADER + SLACK + entry.compressed;
    let head = fetch(entry.offset, want).await?;
    if head.get(..4) != Some(b"PK\x03\x04") {
        return Err(AppError::detail(ErrorCode::BadArchiveEntry, "no local header at the recorded offset")
            .with("file", entry.name.clone()));
    }
    let name_len = u16_at(&head, 26).ok_or_else(|| AppError::new(ErrorCode::BadArchiveEntry))?;
    let extra_len = u16_at(&head, 28).ok_or_else(|| AppError::new(ErrorCode::BadArchiveEntry))?;
    let data_at = LOCAL_HEADER + name_len + extra_len;
    let end = data_at + entry.compressed;

    let raw: Vec<u8> = if (head.len() as u64) >= end {
        head[data_at as usize..end as usize].to_vec()
    } else {
        // The name and extra field ran past the slack: ask for exactly the
        // compressed bytes now that their offset is known.
        fetch(entry.offset + data_at, entry.compressed).await?
    };
    if raw.len() as u64 != entry.compressed {
        return Err(AppError::detail(ErrorCode::BadArchiveEntry, "short read of the entry's data")
            .with("file", entry.name.clone()));
    }

    let out = match entry.method {
        0 => raw,
        8 => {
            let mut out = Vec::with_capacity(usize::try_from(entry.size).unwrap_or(0));
            flate2::read::DeflateDecoder::new(&raw[..])
                .read_to_end(&mut out)
                .map_err(|e| AppError::detail(ErrorCode::BadArchiveEntry, e).with("file", entry.name.clone()))?;
            out
        }
        m => {
            return Err(AppError::detail(ErrorCode::BadArchiveEntry, format!("compression method {m}"))
                .with("file", entry.name.clone()))
        }
    };
    if out.len() as u64 != entry.size {
        return Err(AppError::detail(ErrorCode::ExtractionMismatch, "wrong length after decompression")
            .with("file", entry.name.clone()));
    }
    let mut crc = flate2::Crc::new();
    crc.update(&out);
    if crc.sum() != entry.crc {
        return Err(AppError::detail(ErrorCode::ExtractionMismatch, "CRC mismatch")
            .with("file", entry.name.clone()));
    }
    Ok(out)
}

/// What the end of a remote zip said about it.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum Tail {
    /// Every file entry.
    Listing(Vec<ZipEntry>),
    /// The central directory starts before the bytes given, at this offset.
    NeedFrom(u64),
}

fn u16_at(b: &[u8], at: usize) -> Option<u64> {
    Some(u16::from_le_bytes(b.get(at..at + 2)?.try_into().ok()?).into())
}
fn u32_at(b: &[u8], at: usize) -> Option<u64> {
    Some(u32::from_le_bytes(b.get(at..at + 4)?.try_into().ok()?).into())
}
fn u64_at(b: &[u8], at: usize) -> Option<u64> {
    Some(u64::from_le_bytes(b.get(at..at + 8)?.try_into().ok()?))
}

/// Read a zip's file listing out of its last bytes, before downloading it.
///
/// `tail` is the archive from offset `tail_start` to its end. The zip crate
/// can't do this: it wants the whole archive to seek around in, and its own
/// size-from-the-directory shortcut gives up on entries written with data
/// descriptors — which is every entry in the base archive. So this walks the
/// end-of-central-directory records (zip64 included) and the directory itself
/// by hand. None for anything it doesn't recognise; the caller treats that as
/// "can't tell", never as "empty".
pub(super) fn read_tail(tail: &[u8], tail_start: u64) -> Option<Tail> {
    const EOCD: &[u8] = b"PK\x05\x06";
    const ZIP64_LOCATOR: &[u8] = b"PK\x06\x07";
    const ZIP64_EOCD: &[u8] = b"PK\x06\x06";
    const CENTRAL: &[u8] = b"PK\x01\x02";
    const MAX16: u64 = 0xFFFF;
    const MAX32: u64 = 0xFFFF_FFFF;

    // The record is 22 bytes plus a comment of up to 64 KiB.
    let from = tail.len().saturating_sub(22 + 0xFFFF);
    let eocd = from + tail[from..].windows(4).rposition(|w| w == EOCD)?;
    let mut entries = u16_at(tail, eocd + 10)?;
    let mut cd_size = u32_at(tail, eocd + 12)?;
    let mut cd_off = u32_at(tail, eocd + 16)?;

    if entries == MAX16 || cd_size == MAX32 || cd_off == MAX32 {
        let locator = eocd.checked_sub(20)?;
        if tail.get(locator..locator + 4)? != ZIP64_LOCATOR {
            return None;
        }
        let at = usize::try_from(u64_at(tail, locator + 8)?.checked_sub(tail_start)?).ok()?;
        if tail.get(at..at + 4)? != ZIP64_EOCD {
            return None;
        }
        entries = u64_at(tail, at + 32)?;
        cd_size = u64_at(tail, at + 40)?;
        cd_off = u64_at(tail, at + 48)?;
    }
    if cd_off < tail_start {
        return Some(Tail::NeedFrom(cd_off));
    }

    let mut p = usize::try_from(cd_off - tail_start).ok()?;
    let end = p.checked_add(usize::try_from(cd_size).ok()?)?;
    if end > tail.len() {
        return None;
    }
    let mut listing = Vec::new();
    for _ in 0..entries {
        if tail.get(p..p + 4)? != CENTRAL {
            return None;
        }
        let method = u16::try_from(u16_at(tail, p + 10)?).ok()?;
        let crc = u32::try_from(u32_at(tail, p + 16)?).ok()?;
        let mut compressed = u32_at(tail, p + 20)?;
        let mut size = u32_at(tail, p + 24)?;
        let name_len = usize::try_from(u16_at(tail, p + 28)?).ok()?;
        let extra_len = usize::try_from(u16_at(tail, p + 30)?).ok()?;
        let comment_len = usize::try_from(u16_at(tail, p + 32)?).ok()?;
        let mut offset = u32_at(tail, p + 42)?;
        let name = String::from_utf8_lossy(tail.get(p + 46..p + 46 + name_len)?).into_owned();
        if size == MAX32 || compressed == MAX32 || offset == MAX32 {
            // The zip64 extra field (id 1) carries ONLY the fields that
            // overflowed, in a fixed order: uncompressed size, compressed
            // size, local header offset, disk number. Reading the first u64
            // as the uncompressed size is right only when that is the one
            // that overflowed, which for the base archive's 22 GiB pak it is
            // -- but its offset overflows too, and a repair needs that.
            let extra = tail.get(p + 46 + name_len..p + 46 + name_len + extra_len)?;
            let mut q = 0;
            let mut zip64 = None;
            while q + 4 <= extra.len() {
                let (id, len) = (u16_at(extra, q)?, usize::try_from(u16_at(extra, q + 2)?).ok()?);
                if id == 1 {
                    zip64 = Some(extra.get(q + 4..q + 4 + len)?);
                    break;
                }
                q += 4 + len;
            }
            let zip64 = zip64?;
            let mut at = 0usize;
            let mut take = |field: &mut u64| -> Option<()> {
                if *field == MAX32 {
                    *field = u64_at(zip64, at)?;
                    at += 8;
                }
                Some(())
            };
            take(&mut size)?;
            take(&mut compressed)?;
            take(&mut offset)?;
        }
        if !name.ends_with('/') {
            listing.push(ZipEntry { name, size, compressed, crc, method, offset });
        }
        p += 46 + name_len + extra_len + comment_len;
    }
    Some(Tail::Listing(listing))
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
