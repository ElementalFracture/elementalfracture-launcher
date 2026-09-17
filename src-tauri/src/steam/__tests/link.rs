//! Tests for `steam/link.rs`.

use super::*;

#[test]
fn a_linked_launch_option_is_recognised_even_after_the_install_moved() {
    let launcher = Path::new("/new/place/Elemental Fracture.exe");
    assert!(launch_options_are_ours(&launch_options_for(launcher), launcher));
    assert!(launch_options_are_ours(
        r#""C:\old\place\elemental fracture.exe" %command%"#,
        launcher
    ));
}

#[test]
fn launch_options_the_player_wrote_are_not_ours() {
    let launcher = Path::new("/x/Elemental Fracture.exe");
    for theirs in ["", "-allowmultiple", "%command% -dx11", r#""C:\SKIF.exe" %command%"#] {
        assert!(!launch_options_are_ours(theirs, launcher), "{theirs:?}");
    }
}

#[test]
fn the_tool_script_hands_the_game_launch_to_the_launcher_and_nothing_else() {
    let script = tool_script(Path::new("/home/me/Apps/it's EF.AppImage"));
    assert!(script.starts_with("#!/bin/sh\n"));
    assert!(script.contains(r"exec '/home/me/Apps/it'\''s EF.AppImage'"));
    assert!(script.contains("*Spellbreak.exe*|*g3-Win64*"));
}

#[test]
fn shortcut_ids_are_crc32_with_the_top_bit_set() {
    // CRC-32 of "123456789" is the standard check value.
    assert_eq!(shortcut_appid("12345", "6789"), 0xCBF4_3926 | 0x8000_0000);
    assert_ne!(shortcut_appid("\"/a\"", "Elemental Fracture") & 0x8000_0000, 0);
}

fn other_shortcut() -> Bin {
    let mut e = BinObj::default();
    e.set("appid", Bin::Int(-5));
    e.set("AppName", Bin::Str("Elemental Fracture".into()));
    e.set("Exe", Bin::Str("\"C:\\old-ef.bat\"".into()));
    Bin::Obj(e)
}

#[test]
fn adding_twice_updates_one_entry_and_keeps_its_id() {
    let launcher = Path::new("/apps/ef.AppImage");
    let mut tree = BinObj::default();
    let first = apply_shortcut(&mut tree, launcher, "/icon.png", true).unwrap();
    let second = apply_shortcut(&mut tree, launcher, "/icon2.png", true).unwrap();
    assert_eq!(first, second);
    let list = entries(&mut tree);
    assert_eq!(list.0.len(), 1);
    let Bin::Obj(e) = &list.0[0].1 else { panic!() };
    assert_eq!(e.str("Exe"), Some("\"/apps/ef.AppImage\""));
    assert_eq!(e.str("StartDir"), Some("\"/apps\""));
    assert_eq!(e.str("icon"), Some("/icon2.png"));
}

#[test]
fn a_hand_made_entry_with_the_same_name_is_left_alone() {
    let launcher = Path::new("/apps/ef.AppImage");
    let mut tree = BinObj::default();
    entries(&mut tree).0.push(("0".into(), other_shortcut()));
    apply_shortcut(&mut tree, launcher, "", true);
    assert_eq!(entries(&mut tree).0.len(), 2);
    apply_shortcut(&mut tree, launcher, "", false);
    let list = entries(&mut tree);
    assert_eq!(list.0, vec![("0".to_string(), other_shortcut())]);
}

#[test]
fn removing_renumbers_what_is_left_from_zero() {
    let launcher = Path::new("/apps/ef.AppImage");
    let mut tree = BinObj::default();
    apply_shortcut(&mut tree, launcher, "", true);
    entries(&mut tree).0.push(("1".into(), other_shortcut()));
    apply_shortcut(&mut tree, launcher, "", false);
    let keys: Vec<_> = entries(&mut tree).0.iter().map(|(k, _)| k.clone()).collect();
    assert_eq!(keys, ["0"]);
}
