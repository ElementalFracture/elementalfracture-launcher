//! Tests for `steam/vdf.rs`.

use super::*;

const LOCALCONFIG: &str = r#""UserLocalConfigStore"
{
	"Software"
	{
		"Valve"
		{
			"Steam"
			{
				"Apps"
				{
					"1399780"
					{
						"LaunchOptions"		"\"C:\\Games\\EF\\ef-launcher.exe\" %command%"
						"cloud"
						{
							"last_sync_state"		"synchronized"
						}
					}
				}
			}
		}
	}
	"friends"		"x"
}
"#;

#[test]
fn text_round_trips_byte_for_byte_in_steams_own_layout() {
    let tree = parse_text(LOCALCONFIG).unwrap();
    assert_eq!(write_text(&tree), LOCALCONFIG);
}

#[test]
fn escapes_decode_to_the_real_launch_options() {
    let tree = parse_text(LOCALCONFIG).unwrap();
    let app = tree
        .path(&["UserLocalConfigStore", "Software", "Valve", "Steam", "apps", "1399780"])
        .unwrap();
    assert_eq!(app.str("LaunchOptions"), Some(r#""C:\Games\EF\ef-launcher.exe" %command%"#));
}

#[test]
fn keys_match_whatever_case_steam_wrote() {
    let mut tree = parse_text(LOCALCONFIG).unwrap();
    tree.path_mut(&["userlocalconfigstore", "software", "valve", "steam", "apps", "1399780"])
        .set_str("LaunchOptions", "");
    // Edited in place, not duplicated under a lower-case twin.
    assert_eq!(tree.0.len(), 1);
    assert_eq!(tree.obj("UserLocalConfigStore").unwrap().0.len(), 2);
    let steam = tree.path(&["UserLocalConfigStore", "Software", "Valve", "Steam"]).unwrap();
    assert_eq!(steam.0.len(), 1);
}

#[test]
fn missing_objects_are_created_along_the_path() {
    let mut tree = Obj::default();
    tree.path_mut(&["a", "b"]).set_str("c", "d");
    assert_eq!(parse_text(&write_text(&tree)).unwrap(), tree);
    assert_eq!(tree.path(&["a", "b"]).unwrap().str("c"), Some("d"));
}

#[test]
fn comments_conditionals_and_bare_tokens_are_tolerated() {
    let src = "// header\n\"root\"\n{\n\tkey value [$WIN32]\n\t\"n\" { }\n}\n";
    let tree = parse_text(src).unwrap();
    assert_eq!(tree.obj("root").unwrap().str("key"), Some("value"));
}

#[test]
fn a_truncated_file_is_an_error_not_an_empty_tree() {
    assert!(parse_text("\"root\"\n{\n\t\"k\"\t\t\"v\"\n").is_err());
    assert!(parse_text("\"root\"\n{\n\t\"k\"\t\t\"v").is_err());
}

fn shortcuts_fixture() -> Vec<u8> {
    let mut b = Vec::new();
    b.push(0x00);
    b.extend_from_slice(b"shortcuts\0");
    b.push(0x00);
    b.extend_from_slice(b"0\0");
    b.push(0x02);
    b.extend_from_slice(b"appid\0");
    b.extend_from_slice(&(-1234567i32).to_le_bytes());
    b.push(0x01);
    b.extend_from_slice(b"AppName\0Old EF\0");
    b.push(0x07);
    b.extend_from_slice(b"big\0");
    b.extend_from_slice(&42u64.to_le_bytes());
    b.push(0x00);
    b.extend_from_slice(b"tags\0");
    b.push(0x08);
    b.push(0x08);
    b.push(0x08);
    b.push(0x08);
    b
}

#[test]
fn binary_round_trips_byte_for_byte() {
    let bytes = shortcuts_fixture();
    let tree = parse_binary(&bytes).unwrap();
    assert_eq!(write_binary(&tree), bytes);
}

#[test]
fn binary_values_read_as_their_types() {
    let mut tree = parse_binary(&shortcuts_fixture()).unwrap();
    let entry = match tree.obj_mut("shortcuts").unwrap().0[0].1.clone() {
        Bin::Obj(o) => o,
        _ => panic!("entry should be an object"),
    };
    assert_eq!(entry.int("appid"), Some(-1234567));
    assert_eq!(entry.str("AppName"), Some("Old EF"));
    assert_eq!(entry.get("big"), Some(&Bin::U64(42)));
}

#[test]
fn a_binary_type_we_dont_know_refuses_rather_than_guessing() {
    let mut bytes = shortcuts_fixture();
    bytes[0] = 0x05;
    assert!(parse_binary(&bytes).is_err());
}
