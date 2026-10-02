//! Tests for the version files in `download/install.rs`.
//!
//! These are what the client mod reports and what the appserver gates on, and they belong to the
//! channel rather than to the install: switching onto Playtest has to leave the round's label behind,
//! and switching back has to restore production's.

use super::*;
use tempfile::TempDir;

fn read(root: &Path, rel: &str) -> Option<String> {
    fs::read_to_string(root.join(rel)).ok()
}

#[test]
fn a_version_lands_under_every_name_the_client_reads() {
    let tmp = TempDir::new().unwrap();
    let root = tmp.path();
    write_game_version(root, "7.0.0-lev-rc").unwrap();
    write_mod_version(root, "3.17.2-lev-rc").unwrap();

    assert_eq!(read(root, "version.txt").as_deref(), Some("7.0.0-lev-rc"));
    assert_eq!(read(root, "game_version.txt").as_deref(), Some("7.0.0-lev-rc"));
    assert_eq!(read(root, "Mods/dlls/mod_version.txt").as_deref(), Some("3.17.2-lev-rc"));
    // Pre-split DLLs read only this one, and it is the mod version they want.
    assert_eq!(read(root, "Mods/dlls/ef_version.txt").as_deref(), Some("3.17.2-lev-rc"));
}

/// A label is a version with anything after the numbers: the menu shows the whole string and the gate
/// reads only its numeric head, so the tag rides along untouched.
#[test]
fn a_tagged_label_is_written_exactly_as_published() {
    let tmp = TempDir::new().unwrap();
    for label in ["7.0.0-b1", "7.0.0-lev-rc", "7.0.0-tempest-buff"] {
        write_game_version(tmp.path(), label).unwrap();
        assert_eq!(read(tmp.path(), "version.txt").as_deref(), Some(label));
    }
}

#[test]
fn each_channel_remembers_its_own_versions() {
    let tmp = TempDir::new().unwrap();
    let root = tmp.path();
    remember_versions(root, "ef", Some("6.4.2"), Some("3.17.2"));
    remember_versions(root, "playtest", Some("7.0.0-lev-rc"), Some("3.17.2-lev-rc"));

    assert_eq!(
        remembered_versions(root, "playtest"),
        (Some("7.0.0-lev-rc".into()), Some("3.17.2-lev-rc".into()))
    );
    // Vanilla shares Production's package, so it shares its versions.
    assert_eq!(
        remembered_versions(root, "classic"),
        (Some("6.4.2".into()), Some("3.17.2".into()))
    );
}

/// A run that could only read one track must not erase the other one's answer.
#[test]
fn a_half_known_update_keeps_the_other_track() {
    let tmp = TempDir::new().unwrap();
    let root = tmp.path();
    remember_versions(root, "playtest", Some("7.0.0-b1"), Some("3.17.1-b1"));
    remember_versions(root, "playtest", Some("7.0.0-lev-rc"), None);

    assert_eq!(
        remembered_versions(root, "playtest"),
        (Some("7.0.0-lev-rc".into()), Some("3.17.1-b1".into()))
    );
}

#[test]
fn a_channel_never_written_is_simply_unknown() {
    let tmp = TempDir::new().unwrap();
    assert_eq!(remembered_versions(tmp.path(), "playtest"), (None, None));
    remember_versions(tmp.path(), "playtest", None, None);
    assert!(!tmp.path().join(VERSION_RECORD).exists());
}

/// The record shares Mods/ with the playtest record and the mod channel marker; a corrupt one must not
/// take the launcher down with it.
#[test]
fn a_corrupt_record_reads_as_unknown_and_is_rewritten() {
    let tmp = TempDir::new().unwrap();
    let root = tmp.path();
    fs::create_dir_all(root.join("Mods")).unwrap();
    fs::write(root.join(VERSION_RECORD), "not json at all").unwrap();

    assert_eq!(remembered_versions(root, "ef"), (None, None));
    remember_versions(root, "ef", Some("6.4.2"), None);
    assert_eq!(remembered_versions(root, "ef").0.as_deref(), Some("6.4.2"));
}

#[test]
fn only_a_missing_part_falls_back_to_the_whole_archive() {
    use crate::error::{AppError, ErrorCode};
    // The CDN does not have the parts at all: fall back.
    assert!(parts_missing(&AppError::new(ErrorCode::DownloadFailed).with("status", 404u16)));
    // A transfer that broke, a stall, a hash mismatch: retry the parts, never the 11 GB archive.
    assert!(!parts_missing(&AppError::new(ErrorCode::DownloadFailed).with("status", 503u16)));
    assert!(!parts_missing(&AppError::new(ErrorCode::DownloadFailed)));
    assert!(!parts_missing(&AppError::new(ErrorCode::DownloadStalled)));
    assert!(!parts_missing(&AppError::new(ErrorCode::DownloadHashMismatch)));
}
