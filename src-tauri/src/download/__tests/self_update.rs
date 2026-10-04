//! Tests for `download/self_update.rs`.

use super::*;

/// The dev opt-in is a switch, not a "the variable exists" test — an
/// EF_LAUNCHER_UPDATE=0 left behind in a shell profile means off.
#[test]
fn launcher_update_opt_in_reads_as_a_switch() {
    assert!(opt_in(Some("1")));
    assert!(opt_in(Some("yes")));
    assert!(!opt_in(Some("0")));
    assert!(!opt_in(Some("")));
    assert!(!opt_in(None));
}

const SHA: &str = "e7a6af2b538d7d6d000000000000000000000000000000000000000000000000";

/// A marker for the live version suppresses the prompt only while the binary it was written for is still there.
#[test]
fn marker_suppresses_only_its_own_binary() {
    let marker = format!("3.5.6\n{SHA}\n");
    assert!(marker_suppresses(Some(&marker), "3.5.6", || Some(SHA.to_string())));
    // An old build reinstalled over the profile: same marker, different file.
    assert!(!marker_suppresses(Some(&marker), "3.5.6", || Some("ab".repeat(32))));
    assert!(!marker_suppresses(Some(&marker), "3.5.6", || None));
    // A newer release never hides behind an older marker.
    assert!(!marker_suppresses(Some(&marker), "3.5.7", || Some(SHA.to_string())));
}

#[test]
fn legacy_marker_and_no_marker() {
    assert!(marker_suppresses(Some("3.5.6\n"), "3.5.6", || None));
    assert!(!marker_suppresses(Some("3.5.5"), "3.5.6", || None));
    assert!(!marker_suppresses(None, "3.5.6", || None));
}
