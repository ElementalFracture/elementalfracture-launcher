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
