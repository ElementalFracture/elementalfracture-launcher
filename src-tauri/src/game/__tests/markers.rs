//! Tests for `game/markers.rs`.

use super::*;

#[test]
fn the_mode_marker_is_one_line_and_rewritten_each_time() {
    let tmp = tempfile::tempdir().unwrap();
    let marker = tmp.path().join(".ef_mode");
    write_hidden_mode(tmp.path(), "ef");
    assert_eq!(fs::read_to_string(&marker).unwrap(), "ef\n");
    write_hidden_mode(tmp.path(), "classic");
    assert_eq!(fs::read_to_string(&marker).unwrap(), "classic\n");
}

/// The in-game DLLs only know the Playtest build as "dev"; anything else reads as Production.
#[test]
fn the_playtest_variant_is_written_as_dev() {
    let tmp = tempfile::tempdir().unwrap();
    write_hidden_mode(tmp.path(), "playtest");
    assert_eq!(fs::read_to_string(tmp.path().join(".ef_mode")).unwrap(), "dev\n");
}

/// Best-effort by design: a root that doesn't exist must not panic or
/// bring a launch down.
#[test]
fn an_unwritable_root_is_survived_quietly() {
    let missing = Path::new("/nonexistent-elefrac-root");
    write_hidden_mode(missing, "ef");
}
