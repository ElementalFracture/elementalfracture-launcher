//! Tests for `mods.rs`.

use super::*;

fn game_root() -> tempfile::TempDir {
    let tmp = tempfile::tempdir().unwrap();
    fs::create_dir_all(win64_dir(tmp.path())).unwrap();
    tmp
}

fn mod_zip(entries: &[(&str, &[u8])]) -> Vec<u8> {
    use std::io::Write;
    let mut buf = Cursor::new(Vec::new());
    {
        let mut w = zip::ZipWriter::new(&mut buf);
        let opts = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        for (name, data) in entries {
            w.start_file(*name, opts).unwrap();
            w.write_all(data).unwrap();
        }
        w.finish().unwrap();
    }
    buf.into_inner()
}

/// The one placement rule the whole mod system rests on: the loader is the
/// only DLL the game imports, and it only works from Win64.
#[test]
fn the_loader_goes_to_win64_and_every_other_dll_to_mods_dlls() {
    let tmp = game_root();
    let root = tmp.path();
    let log = install_from_zip(
        root,
        &mod_zip(&[
            ("xinput1_3.dll", b"loader"),
            ("EFCrouch.dll", b"crouch"),
            ("nested/EFHud.dll", b"hud"),
            ("readme.txt", b"ignored"),
        ]),
    )
    .unwrap();

    assert_eq!(fs::read(win64_dir(root).join(LOADER_DLL)).unwrap(), b"loader");
    let dlls = root.join("Mods").join("dlls");
    assert_eq!(fs::read(dlls.join("EFCrouch.dll")).unwrap(), b"crouch");
    // A nested entry keeps its basename, not its directories.
    assert_eq!(fs::read(dlls.join("EFHud.dll")).unwrap(), b"hud");
    // The loader is not ALSO dropped in with the mods.
    assert!(!dlls.join(LOADER_DLL).exists());
    // Non-DLL payload is left in the package.
    assert!(!dlls.join("readme.txt").exists());
    assert!(log.iter().any(|l| l == "3 DLL(s) installed"), "{log:?}");
}

/// Paks bundled with the mods are perpetual — they go where the game reads
/// paks from, and the variant swapper never parks them.
#[test]
fn bundled_paks_land_in_content_paks() {
    let tmp = game_root();
    let root = tmp.path();
    install_from_zip(
        root,
        &mod_zip(&[
            ("xinput1_3.dll", b"loader"),
            ("EFCrouch_P.pak", b"pak"),
            ("EFCrouch_P.sig", b"sig"),
        ]),
    )
    .unwrap();

    let paks = crate::game::paks_dir(root);
    assert_eq!(fs::read(paks.join("EFCrouch_P.pak")).unwrap(), b"pak");
    assert!(paks.join("EFCrouch_P.sig").exists());
}

/// A package that forgot the loader still installs the rest and says so —
/// failing the whole update over it would be worse.
#[test]
fn a_package_without_the_loader_warns_rather_than_failing() {
    let tmp = game_root();
    let log = install_from_zip(tmp.path(), &mod_zip(&[("EFCrouch.dll", b"crouch")])).unwrap();
    assert!(log.iter().any(|l| l.starts_with("WARNING")), "{log:?}");
    assert!(!win64_dir(tmp.path()).join(LOADER_DLL).exists());
}

/// A mod dropped from a later mod.zip must not linger — but the purge is
/// scoped to *.dll, so a config sitting beside them survives.
#[test]
fn stale_dlls_are_purged_and_everything_else_is_left_alone() {
    let tmp = game_root();
    let root = tmp.path();
    let dlls = root.join("Mods").join("dlls");
    fs::create_dir_all(&dlls).unwrap();
    fs::write(dlls.join("Removed.dll"), b"old").unwrap();
    fs::write(dlls.join("keep.cfg"), b"cfg").unwrap();

    install_from_zip(root, &mod_zip(&[("xinput1_3.dll", b"loader")])).unwrap();

    assert!(!dlls.join("Removed.dll").exists());
    assert!(dlls.join("keep.cfg").exists());
}

/// Auth moved into the launcher; an install scrubs the plaintext copies an
/// older one left in the game folder.
#[test]
fn legacy_plaintext_auth_files_are_scrubbed() {
    let tmp = game_root();
    let root = tmp.path();
    let cmds = root.join("Mods").join("commands");
    fs::create_dir_all(&cmds).unwrap();
    fs::write(cmds.join("auth_token.txt"), b"secret").unwrap();
    fs::write(cmds.join("ef_server.txt"), b"host").unwrap();

    let log = install_from_zip(root, &mod_zip(&[("xinput1_3.dll", b"loader")])).unwrap();

    assert!(!cmds.join("auth_token.txt").exists());
    assert!(!cmds.join("ef_server.txt").exists());
    assert!(log.iter().any(|l| l.contains("auth_token.txt")), "{log:?}");
}
