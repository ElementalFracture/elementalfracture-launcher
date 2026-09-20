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

/// Install a package on a channel, the way `fetch_and_install` would once the
/// bytes have been verified.
fn install(root: &Path, entries: &[(&str, &[u8])], channel: &str) -> Vec<String> {
    let bytes = mod_zip(entries);
    let sha = crate::download::manifest::sha256_hex(&bytes);
    install_from_zip(root, &bytes, channel, &sha).unwrap()
}

/// The one placement rule the whole mod system rests on: the loader is the
/// only DLL the game imports, and it only works from Win64.
#[test]
fn the_loader_goes_to_win64_and_every_other_dll_to_mods_dlls() {
    let tmp = game_root();
    let root = tmp.path();
    let log = install(
        root,
        &[
            ("xinput1_3.dll", b"loader"),
            ("EFCrouch.dll", b"crouch"),
            ("nested/EFHud.dll", b"hud"),
            ("readme.txt", b"ignored"),
        ],
        CHANNEL_EF,
    );

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
    install(
        root,
        &[
            ("xinput1_3.dll", b"loader"),
            ("EFCrouch_P.pak", b"pak"),
            ("EFCrouch_P.sig", b"sig"),
        ],
        CHANNEL_EF,
    );

    let paks = crate::game::paks_dir(root);
    assert_eq!(fs::read(paks.join("EFCrouch_P.pak")).unwrap(), b"pak");
    assert!(paks.join("EFCrouch_P.sig").exists());
}

/// A package that forgot the loader still installs the rest and says so —
/// failing the whole update over it would be worse.
#[test]
fn a_package_without_the_loader_warns_rather_than_failing() {
    let tmp = game_root();
    let log = install(tmp.path(), &[("EFCrouch.dll", b"crouch")], CHANNEL_EF);
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

    install(root, &[("xinput1_3.dll", b"loader")], CHANNEL_EF);

    assert!(!dlls.join("Removed.dll").exists());
    assert!(dlls.join("keep.cfg").exists());
}

/// Auth moved into the launcher; an install scrubs the plaintext copies an
/// older one left in the game folder — the `Mods/commands` text files, and the
/// `.ef_auth` marker that replaced them.
#[test]
fn legacy_plaintext_auth_files_are_scrubbed() {
    let tmp = game_root();
    let root = tmp.path();
    let cmds = root.join("Mods").join("commands");
    fs::create_dir_all(&cmds).unwrap();
    fs::write(cmds.join("auth_token.txt"), b"secret").unwrap();
    fs::write(cmds.join("ef_server.txt"), b"host").unwrap();
    fs::write(root.join(".ef_auth"), b"tok\nhost\n").unwrap();

    let log = install(root, &[("xinput1_3.dll", b"loader")], CHANNEL_EF);

    assert!(!cmds.join("auth_token.txt").exists());
    assert!(!cmds.join("ef_server.txt").exists());
    assert!(!root.join(".ef_auth").exists());
    assert!(log.iter().any(|l| l.contains("auth_token.txt")), "{log:?}");
    assert!(log.iter().any(|l| l.contains(".ef_auth")), "{log:?}");
}

/// The point of separate channels: what the Playtest package brought must be
/// gone once Production is back, paks included. The DLL purge covers Mods/dlls
/// on its own; a pak only the playtest build ships would otherwise stay mounted
/// in a production match.
#[test]
fn switching_channels_takes_the_other_channels_files_back_off() {
    let tmp = game_root();
    let root = tmp.path();
    let paks = crate::game::paks_dir(root);

    install(
        root,
        &[
            ("xinput1_3.dll", b"playtest loader"),
            ("crouch_mod.dll", b"ch2 levitation"),
            ("EFPlaytestOnly_P.pak", b"playtest pak"),
        ],
        CHANNEL_PLAYTEST,
    );
    assert!(paks.join("EFPlaytestOnly_P.pak").exists());

    let log = install(
        root,
        &[("xinput1_3.dll", b"prod loader"), ("crouch_mod.dll", b"shipped")],
        CHANNEL_EF,
    );

    assert!(!paks.join("EFPlaytestOnly_P.pak").exists(), "{log:?}");
    assert_eq!(fs::read(win64_dir(root).join(LOADER_DLL)).unwrap(), b"prod loader");
    assert_eq!(
        fs::read(root.join("Mods").join("dlls").join("crouch_mod.dll")).unwrap(),
        b"shipped"
    );
}

/// A package the machine already has needs neither the network nor an
/// extraction to switch onto — and "already has" means the files are really
/// there, not just that the record says so.
#[test]
fn an_installed_channel_is_recognised_only_while_its_files_are_present() {
    let tmp = game_root();
    let root = tmp.path();
    install(root, &[("xinput1_3.dll", b"loader"), ("crouch_mod.dll", b"mod")], CHANNEL_PLAYTEST);

    assert!(channel_installed(root, CHANNEL_PLAYTEST));
    assert!(!channel_installed(root, CHANNEL_EF));

    fs::remove_file(root.join("Mods").join("dlls").join("crouch_mod.dll")).unwrap();
    assert!(!channel_installed(root, CHANNEL_PLAYTEST));
}

/// The record drives deletions and lives in the game folder, so it may only
/// ever name the three places a package writes to.
#[test]
fn the_record_can_only_name_files_a_package_owns() {
    assert!(is_mod_path("Mods/dlls/crouch_mod.dll"));
    assert!(is_mod_path("g3/Content/Paks/EFCrouch_P.pak"));
    assert!(is_mod_path("g3/Binaries/Win64/xinput1_3.dll"));

    assert!(!is_mod_path("g3/Content/Paks/../../../etc/passwd"));
    assert!(!is_mod_path("g3/Binaries/Win64/g3-Win64-Shipping.exe"));
    assert!(!is_mod_path("version.txt"));
    assert!(!is_mod_path("Mods/commands/keep.cfg"));
}
