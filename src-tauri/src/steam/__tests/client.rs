//! Tests for `steam/client.rs`.

use super::*;

fn fake_steam() -> (tempfile::TempDir, Steam) {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().to_path_buf();
    fs::create_dir_all(root.join("steamapps")).unwrap();
    fs::create_dir_all(root.join("config")).unwrap();
    (dir, Steam { root })
}

fn add_user(steam: &Steam, account: &str) {
    fs::create_dir_all(steam.user_config(account)).unwrap();
}

#[test]
fn the_most_recent_login_is_the_active_user() {
    let (_dir, steam) = fake_steam();
    add_user(&steam, "22");
    add_user(&steam, "33");
    fs::write(
        steam.root.join("config/loginusers.vdf"),
        "\"users\"\n{\n\t\"76561197960265750\"\n\t{\n\t\t\"MostRecent\"\t\t\"0\"\n\t}\n\t\"76561197960265761\"\n\t{\n\t\t\"MostRecent\"\t\t\"1\"\n\t}\n}\n",
    )
    .unwrap();
    assert_eq!(steam.active_user().as_deref(), Some("33"));
}

#[test]
fn without_login_history_a_lone_account_is_used_and_several_are_not_guessed() {
    let (_dir, steam) = fake_steam();
    assert_eq!(steam.active_user(), None);
    add_user(&steam, "22");
    assert_eq!(steam.active_user().as_deref(), Some("22"));
    add_user(&steam, "33");
    assert_eq!(steam.active_user(), None);
}

#[test]
fn installed_apps_are_found_in_any_library_folder() {
    let (_dir, steam) = fake_steam();
    let other = tempfile::tempdir().unwrap();
    fs::create_dir_all(other.path().join("steamapps")).unwrap();
    fs::write(
        steam.root.join("steamapps/libraryfolders.vdf"),
        vdf::write_text(&{
            let mut t = vdf::Obj::default();
            t.path_mut(&["libraryfolders", "1"])
                .set_str("path", &other.path().to_string_lossy());
            t
        }),
    )
    .unwrap();
    assert!(!steam.app_installed("1399780"));
    fs::write(other.path().join("steamapps/appmanifest_1399780.acf"), "").unwrap();
    assert!(steam.app_installed("1399780"));
}
