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

/// The declared size is written by whoever built the archive, so the copy has
/// its own budget: an entry that lies low and streams on forever is stopped at
/// the ceiling rather than when the disk fills.
#[test]
fn a_copy_that_outruns_its_budget_is_stopped() {
    let tmp = tempfile::tempdir().unwrap();
    let out_path = tmp.path().join("out");

    let mut budget = 4u64;
    let mut out = File::create(&out_path).unwrap();
    let err = copy_within_budget(&mut &b"12345"[..], &mut out, &mut budget).unwrap_err();
    assert_eq!(err.code, ErrorCode::ArchiveTooLarge);

    // Within budget it copies faithfully and leaves the remainder.
    let mut budget = 16u64;
    let mut out = File::create(&out_path).unwrap();
    copy_within_budget(&mut &b"12345"[..], &mut out, &mut budget).unwrap();
    drop(out);
    assert_eq!(fs::read(&out_path).unwrap(), b"12345");
    assert_eq!(budget, 11);
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
