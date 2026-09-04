//! Tests for `game/install.rs`.

use super::*;

/// version.txt written by the OLD launcher is UTF-16LE with a BOM; ours and
/// the CDN's are plain UTF-8. Reading only one of the two is how an install
/// looks permanently out of date.
#[test]
fn version_txt_decodes_both_encodings_it_ships_in() {
    assert_eq!(decode_version_bytes(b"6.0.2"), "6.0.2");
    assert_eq!(decode_version_bytes(b"  6.0.2\r\n"), "6.0.2");

    let mut utf16 = vec![0xFF, 0xFE];
    for unit in "6.0.2\r\n".encode_utf16() {
        utf16.extend(unit.to_le_bytes());
    }
    assert_eq!(decode_version_bytes(&utf16), "6.0.2");
}

#[test]
fn a_missing_or_blank_version_file_is_none_not_an_empty_string() {
    let tmp = tempfile::tempdir().unwrap();
    assert_eq!(read_local_version(tmp.path()), None);
    fs::write(tmp.path().join("version.txt"), b"   \n").unwrap();
    assert_eq!(read_local_version(tmp.path()), None);
    fs::write(tmp.path().join("version.txt"), b"6.0.2").unwrap();
    assert_eq!(read_local_version(tmp.path()).as_deref(), Some("6.0.2"));
}

/// The root-level Spellbreak.exe is a shim: it only counts when the real
/// Win64 folder holds nothing.
#[test]
fn a_win64_binary_beats_the_root_shim() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path();
    let win64 = root.join("g3").join("Binaries").join("Win64");
    fs::create_dir_all(&win64).unwrap();
    fs::write(root.join("Spellbreak.exe"), b"shim").unwrap();

    // Shim only.
    assert_eq!(find_exe(root), Some(root.join("Spellbreak.exe")));

    // The community archive's name is found in Win64.
    fs::write(win64.join("g3-Win64-Test.exe"), b"exe").unwrap();
    assert_eq!(find_exe(root), Some(win64.join("g3-Win64-Test.exe")));

    // A retail install's name wins over it — WIN64_EXES is in priority order.
    fs::write(win64.join("Spellbreak.exe"), b"exe").unwrap();
    assert_eq!(find_exe(root), Some(win64.join("Spellbreak.exe")));
}

#[test]
fn a_folder_with_no_binary_is_not_an_install() {
    let tmp = tempfile::tempdir().unwrap();
    assert_eq!(find_exe(tmp.path()), None);
}
