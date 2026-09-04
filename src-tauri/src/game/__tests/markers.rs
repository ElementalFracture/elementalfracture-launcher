//! Tests for `game/markers.rs`.

use super::*;

#[test]
fn the_auth_marker_is_token_then_host_one_per_line() {
    let tmp = tempfile::tempdir().unwrap();
    write_hidden_auth(tmp.path(), "tok123", "play.elefrac.com");
    assert_eq!(
        fs::read_to_string(tmp.path().join(".ef_auth")).unwrap(),
        "tok123\nplay.elefrac.com\n"
    );
}

/// Signing out has to REMOVE the file: a blank one would leave the injector
/// reading an empty token instead of knowing there is none.
#[test]
fn an_empty_token_removes_the_marker_rather_than_blanking_it() {
    let tmp = tempfile::tempdir().unwrap();
    let marker = tmp.path().join(".ef_auth");
    write_hidden_auth(tmp.path(), "tok123", "host");
    assert!(marker.exists());
    write_hidden_auth(tmp.path(), "", "host");
    assert!(!marker.exists());
}

#[test]
fn the_mode_marker_is_one_line_and_rewritten_each_time() {
    let tmp = tempfile::tempdir().unwrap();
    let marker = tmp.path().join(".ef_mode");
    write_hidden_mode(tmp.path(), "ef");
    assert_eq!(fs::read_to_string(&marker).unwrap(), "ef\n");
    write_hidden_mode(tmp.path(), "classic");
    assert_eq!(fs::read_to_string(&marker).unwrap(), "classic\n");
}

/// Best-effort by design: a root that doesn't exist must not panic or
/// bring a launch down.
#[test]
fn an_unwritable_root_is_survived_quietly() {
    let missing = Path::new("/nonexistent-elefrac-root");
    write_hidden_mode(missing, "ef");
    write_hidden_auth(missing, "tok", "host");
}
