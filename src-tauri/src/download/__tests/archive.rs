//! Tests for `download/archive.rs`.

use super::*;

#[test]
fn tar_reader_pulls_umu_run() {
    // Build a minimal two-entry tar (a dir + the umu-run regular file) and
    // confirm the reader extracts exactly the file's bytes.
    fn header(name: &str, size: u64, typeflag: u8) -> Vec<u8> {
        let mut h = vec![0u8; 512];
        let nb = name.as_bytes();
        h[..nb.len()].copy_from_slice(nb);
        let octal = format!("{size:011o}\0");
        h[124..124 + octal.len()].copy_from_slice(octal.as_bytes());
        h[156] = typeflag;
        h
    }
    let payload = b"#!/usr/bin/env python3\nPK-zipapp-bytes";
    let mut tar = Vec::new();
    tar.extend(header("umu/", 0, b'5'));
    tar.extend(header("umu/umu-run", payload.len() as u64, b'0'));
    tar.extend(payload);
    tar.extend(vec![0u8; 512 - payload.len() % 512]); // pad to 512
    tar.extend(vec![0u8; 1024]); // end-of-archive

    let tmp = tempfile::tempdir().unwrap();
    let tar_path = tmp.path().join("umu.tar");
    let out = tmp.path().join("umu-run");
    fs::write(&tar_path, &tar).unwrap();
    extract_umu_run(&tar_path, &out).unwrap();
    assert_eq!(fs::read(&out).unwrap(), payload);
}

#[test]
fn tar_reader_errors_when_absent() {
    let tmp = tempfile::tempdir().unwrap();
    let tar_path = tmp.path().join("empty.tar");
    fs::write(&tar_path, vec![0u8; 1024]).unwrap();
    assert!(extract_umu_run(&tar_path, &tmp.path().join("umu-run")).is_err());
}

/// A zip on disk, built entry by entry — the shape the CDN actually
/// serves, rather than a stubbed reader.
fn zip_file(dir: &Path, name: &str, entries: &[(&str, &[u8])]) -> PathBuf {
    let mut buf = std::io::Cursor::new(Vec::new());
    {
        let mut w = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        for (entry, data) in entries {
            w.start_file(*entry, opts).unwrap();
            w.write_all(data).unwrap();
        }
        w.finish().unwrap();
    }
    let path = dir.join(name);
    fs::write(&path, buf.into_inner()).unwrap();
    path
}

/// The sanitiser exists because `enclosed_name()` used to drop these
/// entries silently, which is how an install ends up missing paks and
/// rendering garbage. Everything here must land somewhere under the
/// destination — never above it, never nowhere.
#[test]
fn odd_entry_names_are_clamped_under_the_destination() {
    let cases = [
        ("g3\\Content\\Paks\\a.pak", "g3/Content/Paks/a.pak"),
        ("/g3/a.pak", "g3/a.pak"),
        ("C:/g3/a.pak", "g3/a.pak"),
        ("./g3/./a.pak", "g3/a.pak"),
        ("../../../etc/passwd", "etc/passwd"),
        ("g3/../../../elsewhere.pak", "elsewhere.pak"),
    ];
    for (raw, want) in cases {
        assert_eq!(safe_rel_path(raw), Some(PathBuf::from(want)), "{raw}");
    }
}

/// Only a name that sanitises to *nothing* may be dropped — a directory
/// marker. A real file always resolves.
#[test]
fn only_an_empty_name_resolves_to_nothing() {
    for empty in ["", "/", ".", "../..", "C:"] {
        assert_eq!(safe_rel_path(empty), None, "{empty}");
    }
    assert!(safe_rel_path("assets/../pak.pak").is_some());
}

#[test]
fn the_patch_zip_flattens_into_one_paks_dir() {
    let tmp = tempfile::tempdir().unwrap();
    let dest = tmp.path().join("Paks");
    fs::create_dir_all(&dest).unwrap();
    let zip = zip_file(
        tmp.path(),
        "patch.zip",
        &[
            ("ElefracBalance_P.pak", b"pak"),
            ("nested/dir/ElefracBalance_P.sig", b"sig"),
        ],
    );

    let mut names = extract_flat(&zip, &dest).unwrap();
    names.sort();
    assert_eq!(names, ["ElefracBalance_P.pak", "ElefracBalance_P.sig"]);
    // Flat: the nested entry lost its directories, not its contents.
    assert_eq!(fs::read(dest.join("ElefracBalance_P.sig")).unwrap(), b"sig");
}

/// Whatever the playtest archive calls its pak inside, it has to come out
/// under the names `apply_variant` looks for.
#[test]
fn the_playtest_pak_is_staged_under_the_name_the_variant_expects() {
    let tmp = tempfile::tempdir().unwrap();
    let paks = tmp.path().join("Paks");
    fs::create_dir_all(&paks).unwrap();
    let zip = zip_file(
        tmp.path(),
        "dev.zip",
        &[("build_42_P.pak", b"pak"), ("build_42_P.sig", b"sig")],
    );

    assert_eq!(stage_test_pak(&zip, &paks).unwrap(), "pak + sig");
    assert_eq!(fs::read(paks.join("ElefracTest_P.pak")).unwrap(), b"pak");
    assert_eq!(fs::read(paks.join("ElefracTest_P.sig")).unwrap(), b"sig");
}

#[test]
fn an_unsigned_playtest_pak_still_installs_and_says_so() {
    let tmp = tempfile::tempdir().unwrap();
    let paks = tmp.path().join("Paks");
    fs::create_dir_all(&paks).unwrap();
    let zip = zip_file(tmp.path(), "dev.zip", &[("build_42_P.pak", b"pak")]);
    assert_eq!(stage_test_pak(&zip, &paks).unwrap(), "pak (unsigned)");
}

/// An archive with no pak at all must fail loudly — staging nothing and
/// then switching the variant onto it is the broken-install path.
#[test]
fn a_playtest_archive_with_no_pak_is_an_error() {
    let tmp = tempfile::tempdir().unwrap();
    let paks = tmp.path().join("Paks");
    fs::create_dir_all(&paks).unwrap();
    let zip = zip_file(tmp.path(), "dev.zip", &[("readme.txt", b"nothing here")]);
    assert_eq!(
        stage_test_pak(&zip, &paks).unwrap_err().code,
        ErrorCode::PlaytestArchiveEmpty
    );
}

/// The declared total is what drives the progress bar as well as the ceiling,
/// so it has to be the real sum and not an approximation.
#[test]
fn the_declared_size_is_the_sum_of_the_entries() {
    let tmp = tempfile::tempdir().unwrap();
    let zip = zip_file(
        tmp.path(),
        "base.zip",
        &[("a.pak", b"1234567890"), ("nested/b.pak", b"12345")],
    );
    let mut archive = zip::ZipArchive::new(File::open(&zip).unwrap()).unwrap();
    assert_eq!(declared_size(&mut archive).unwrap(), 15);
}

/// A bomb is a small file whose central directory promises terabytes, so the
/// refusal has to land on the *declared* total, before anything is written.
#[test]
fn an_archive_declaring_more_than_the_ceiling_is_refused() {
    let tmp = tempfile::tempdir().unwrap();
    let zip = zip_file(tmp.path(), "bomb.zip", &[("a.pak", b"1234567890")]);
    let mut archive = zip::ZipArchive::new(File::open(&zip).unwrap()).unwrap();

    let err = declared_size_within(&mut archive, 9).unwrap_err();
    assert_eq!(err.code, ErrorCode::ArchiveTooLarge);
    // The user is told what it wanted and what it was allowed.
    assert!(err.params.contains_key("size"), "{:?}", err.params);
    assert!(err.params.contains_key("limit"), "{:?}", err.params);
    // Exactly at the ceiling is fine — only past it fails.
    assert_eq!(declared_size_within(&mut archive, 10).unwrap(), 10);
}

/// `spend` is the whole ceiling in one line, so its edge is worth pinning:
/// spending exactly what is left is allowed, one byte more is not.
#[test]
fn spending_the_last_byte_is_allowed_and_the_next_one_is_not() {
    let mut budget = 2u64;
    spend(&mut budget, 2).unwrap();
    assert_eq!(budget, 0);
    assert_eq!(
        spend(&mut budget, 1).unwrap_err().code,
        ErrorCode::ArchiveTooLarge
    );
}

/// Bytes that don't compress away and don't repeat on a buffer boundary, so a
/// chunk landing at the wrong offset can't compare equal by accident.
fn noise(len: usize, seed: u32) -> Vec<u8> {
    let mut x = seed.wrapping_mul(2_654_435_761).max(1);
    (0..len)
        .map(|_| {
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            x as u8
        })
        .collect()
}

/// Deflated, like the CDN's archive, with entries bigger than the 1 MiB copy
/// buffer so every chunk boundary is crossed.
fn deflated_zip(dir: &Path, entries: &[(&str, &[u8])]) -> PathBuf {
    let path = dir.join("base.zip");
    let mut w = zip::ZipWriter::new(File::create(&path).unwrap());
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .large_file(true);
    for (entry, data) in entries {
        w.start_file(*entry, opts).unwrap();
        w.write_all(data).unwrap();
    }
    w.finish().unwrap();
    path
}

/// Where each file should land, and what it should hold.
type Expected = Vec<(PathBuf, Vec<u8>)>;

/// The shape of the real base archive, planned into `<tmp>/install`.
fn base_archive(tmp: &Path) -> (zip::ZipArchive<File>, Vec<Target>, Expected) {
    let files = [
        ("g3/Binaries/Win64/g3-Win64-Test.exe", noise(3 << 20, 1)),
        ("g3/Content/Paks/g3-WindowsNoEditor.pak", noise((5 << 20) + 17, 2)),
        ("g3/Content/Paks/g3-WindowsNoEditor.sig", noise(4096, 3)),
        ("Engine/Config/empty.ini", Vec::new()),
    ];
    let entries: Vec<(&str, &[u8])> = files.iter().map(|(n, d)| (*n, d.as_slice())).collect();
    let zip_path = deflated_zip(tmp, &entries);
    let dest = tmp.join("install");
    let mut zip = zip::ZipArchive::new(File::open(zip_path).unwrap()).unwrap();
    let targets = plan_tree(&mut zip, &dest).unwrap();
    let expect = files.iter().map(|(n, d)| (dest.join(n), d.clone())).collect();
    (zip, targets, expect)
}

fn assert_on_disk(expect: &[(PathBuf, Vec<u8>)]) {
    for (path, data) in expect {
        assert!(fs::read(path).unwrap() == *data, "{} differs from the archive", path.display());
    }
}

#[test]
fn every_file_is_written_then_read_back_against_the_archive() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut zip, targets, expect) = base_archive(tmp.path());
    let mut passes = Vec::new();
    unpack_verified(&mut zip, &targets, &mut |pass, _, _, _| {
        if passes.last() != Some(&pass) {
            passes.push(pass);
        }
    })
    .unwrap();
    assert_on_disk(&expect);
    assert_eq!(passes, [Pass::Write, Pass::Verify], "nothing to repair on a clean run");
}

/// Something changes files after they land (antivirus, a flaky disk, an
/// earlier install's leftovers): the read-back has to notice each way a file
/// can be wrong, not just a missing one.
#[test]
fn the_read_back_finds_every_way_a_file_can_be_wrong() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut zip, targets, expect) = base_archive(tmp.path());
    unpack_verified(&mut zip, &targets, &mut |_, _, _, _| {}).unwrap();

    let exe = &expect[0].0;
    let pak = &expect[1].0;
    let sig = &expect[2].0;
    let ini = &expect[3].0;
    // One byte flipped deep inside the second chunk, same length.
    let mut bytes = fs::read(pak).unwrap();
    bytes[(1 << 20) + 12_345] ^= 0x40;
    fs::write(pak, &bytes).unwrap();
    // Quarantined.
    fs::remove_file(exe).unwrap();
    // Grown by one byte.
    let mut bytes = fs::read(sig).unwrap();
    bytes.push(0);
    fs::write(sig, &bytes).unwrap();
    // A directory where a file should be.
    fs::remove_file(ini).unwrap();
    fs::create_dir(ini).unwrap();

    let all: Vec<&Target> = targets.iter().collect();
    let bad: Vec<&str> = mismatched(&mut zip, &all, &mut |_, _, _, _| {})
        .unwrap()
        .iter()
        .map(|t| t.name.as_str())
        .collect();
    assert_eq!(
        bad,
        [
            "g3/Binaries/Win64/g3-Win64-Test.exe",
            "g3/Content/Paks/g3-WindowsNoEditor.pak",
            "g3/Content/Paks/g3-WindowsNoEditor.sig",
            "Engine/Config/empty.ini",
        ]
    );
}

/// A file damaged between the write and the read-back is written again, and
/// only it: the job still ends with the archive's bytes on disk.
#[test]
fn a_file_damaged_after_writing_is_extracted_again() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut zip, targets, expect) = base_archive(tmp.path());
    let pak = expect[1].0.clone();
    let mut damaged = false;
    let mut repaired = Vec::new();
    unpack_verified(&mut zip, &targets, &mut |pass, name, _, _| match pass {
        // The read-back has started on the exe; damage the pak before it
        // gets there.
        Pass::Verify if !damaged => {
            let mut bytes = fs::read(&pak).unwrap();
            bytes[7] ^= 1;
            fs::write(&pak, bytes).unwrap();
            damaged = true;
        }
        Pass::Repair => repaired.push(name.to_string()),
        _ => {}
    })
    .unwrap();
    assert!(damaged);
    repaired.dedup();
    assert_eq!(repaired, ["g3/Content/Paks/g3-WindowsNoEditor.pak"]);
    assert_on_disk(&expect);
}

/// Something that damages a file every time it lands (antivirus rewriting it)
/// can't be out-waited: after the repair rounds the job fails, naming it,
/// rather than reporting an install that won't launch as complete.
#[test]
fn a_file_that_never_reads_back_right_fails_the_job_by_name() {
    let tmp = tempfile::tempdir().unwrap();
    let (mut zip, targets, expect) = base_archive(tmp.path());
    let exe = expect[0].0.clone();
    let mut repairs = 0;
    let mut last = Pass::Write;
    let err = unpack_verified(&mut zip, &targets, &mut |pass, name, done, _| {
        if pass == Pass::Repair && last != Pass::Repair {
            repairs += 1;
        }
        last = pass;
        // First chunk of the exe compared: spoil the last byte, so the second
        // chunk never matches.
        if pass == Pass::Verify && name.ends_with(".exe") && done == 1 << 20 {
            let mut bytes = fs::read(&exe).unwrap();
            *bytes.last_mut().unwrap() ^= 1;
            fs::write(&exe, bytes).unwrap();
        }
    })
    .unwrap_err();
    assert_eq!(err.code, ErrorCode::ExtractionMismatch);
    assert_eq!(err.params["count"], "1");
    assert_eq!(err.params["files"], "g3/Binaries/Win64/g3-Win64-Test.exe");
    assert_eq!(repairs, REPAIR_ROUNDS);
}

/// An earlier install's file left read-only can't be opened for writing; the
/// job replaces it rather than failing on it.
#[test]
fn a_read_only_file_in_the_way_is_replaced() {
    let tmp = tempfile::tempdir().unwrap();
    let paks = tmp.path().join("Paks");
    fs::create_dir_all(&paks).unwrap();
    let old = paks.join("ElefracBalance_P.pak");
    fs::write(&old, b"last season's pak").unwrap();
    let mut perms = fs::metadata(&old).unwrap().permissions();
    perms.set_readonly(true);
    fs::set_permissions(&old, perms).unwrap();

    let zip = zip_file(tmp.path(), "patch.zip", &[("ElefracBalance_P.pak", b"this season's pak")]);
    extract_flat(&zip, &paks).unwrap();
    assert_eq!(fs::read(&old).unwrap(), b"this season's pak");
}

/// Two entries that land on one file (NTFS and Proton don't tell case apart)
/// are fine when they're the same file twice, and refused when they aren't —
/// otherwise whichever was written second silently wins.
#[test]
fn entries_colliding_on_one_file_must_agree() {
    let tmp = tempfile::tempdir().unwrap();
    let dest = tmp.path().join("Paks");
    fs::create_dir_all(&dest).unwrap();

    let same = zip_file(tmp.path(), "same.zip", &[("a/X.pak", b"pak"), ("b/x.PAK", b"pak")]);
    assert_eq!(extract_flat(&same, &dest).unwrap(), ["X.pak"]);

    let differ = zip_file(tmp.path(), "differ.zip", &[("a/X.pak", b"pak"), ("b/x.PAK", b"other")]);
    assert_eq!(
        extract_flat(&differ, &dest).unwrap_err().code,
        ErrorCode::BadArchiveEntry
    );
}

/// Only failures that pass on their own are retried; the rest must fail at
/// once rather than after seconds of backing off.
#[test]
fn only_passing_io_failures_are_retried() {
    use io::ErrorKind::*;
    for kind in [PermissionDenied, Interrupted, WouldBlock, TimedOut] {
        assert!(transient(&io::Error::from(kind)), "{kind:?}");
    }
    for kind in [NotFound, StorageFull, InvalidData, AlreadyExists] {
        assert!(!transient(&io::Error::from(kind)), "{kind:?}");
    }
}

/// The per-pass budget is what stops an entry that declares little and
/// streams on forever. Running out is final: no retry, no back-off.
#[test]
fn an_entry_that_outruns_the_budget_is_stopped_without_retrying() {
    let tmp = tempfile::tempdir().unwrap();
    let zip_path = zip_file(tmp.path(), "bomb.zip", &[("a.pak", b"1234567890")]);
    let mut zip = zip::ZipArchive::new(File::open(zip_path).unwrap()).unwrap();
    let targets = plan_tree(&mut zip, &tmp.path().join("out")).unwrap();

    let started = Instant::now();
    let mut budget = 4u64;
    let mut buf = vec![0u8; 1 << 20];
    let err = write_target(&mut zip, &targets[0], &mut budget, &mut buf, &mut |_| {}).unwrap_err();
    assert_eq!(err.code, ErrorCode::ArchiveTooLarge);
    assert!(started.elapsed() < Duration::from_millis(400), "was retried");
}

/// The listing read off the end of an archive has to agree with what the zip
/// crate reads from the whole thing, and skip directory entries.
#[test]
fn the_tail_of_an_archive_lists_its_files_and_sizes() {
    let tmp = tempfile::tempdir().unwrap();
    let pak = noise(70_000, 9);
    let path = deflated_zip(tmp.path(), &[("g3/Content/Paks/a.pak", &pak), ("g3/version.txt", b"6.2.17")]);
    let bytes = fs::read(&path).unwrap();

    assert_eq!(
        read_tail(&bytes, 0),
        Some(Tail::Listing(vec![
            ("g3/Content/Paks/a.pak".into(), 70_000),
            ("g3/version.txt".into(), 6),
        ]))
    );
}

/// Given only the last few bytes, it says where the directory starts rather
/// than guessing, and reading from there gives the full listing.
#[test]
fn a_tail_too_short_for_the_directory_asks_for_more() {
    let tmp = tempfile::tempdir().unwrap();
    let pak = noise(70_000, 9);
    let path = deflated_zip(tmp.path(), &[("a.pak", &pak)]);
    let bytes = fs::read(&path).unwrap();

    let start = bytes.len() - 30;
    let Some(Tail::NeedFrom(offset)) = read_tail(&bytes[start..], start as u64) else {
        panic!("expected a request for more of the archive");
    };
    let offset = offset as usize;
    assert_eq!(
        read_tail(&bytes[offset..], offset as u64),
        Some(Tail::Listing(vec![("a.pak".into(), 70_000)]))
    );
}

#[test]
fn a_tail_that_isnt_a_zip_is_none_not_an_empty_listing() {
    assert_eq!(read_tail(b"<html>404 Not Found</html>", 0), None);
    assert_eq!(read_tail(&[], 0), None);
}

/// Installing over an earlier install only needs room for what grows: a file
/// already there gives its space back when it's replaced.
#[test]
fn files_already_in_place_count_against_the_space_needed() {
    let tmp = tempfile::tempdir().unwrap();
    let dest = tmp.path();
    fs::create_dir_all(dest.join("g3")).unwrap();
    fs::write(dest.join("g3/a.pak"), vec![0u8; 600]).unwrap();
    fs::write(dest.join("g3/b.pak"), vec![0u8; 2000]).unwrap();
    let listing = vec![
        ("g3/a.pak".to_string(), 1000), // 400 more than what's there
        ("g3/b.pak".to_string(), 1000), // smaller than what's there: nothing
        ("g3\\c.pak".to_string(), 300), // new, and named the Windows way
    ];
    assert_eq!(bytes_to_unpack(&listing, dest), 700);
}

#[test]
fn an_install_that_cannot_fit_is_refused_up_front() {
    let tmp = tempfile::tempdir().unwrap();
    let err = ensure_room(tmp.path(), u64::MAX / 2).unwrap_err();
    assert_eq!(err.code, ErrorCode::NotEnoughSpace);
    for key in ["need", "free", "path"] {
        assert!(err.params.contains_key(key), "{key}: {:?}", err.params);
    }
    ensure_room(tmp.path(), 0).unwrap();
}
