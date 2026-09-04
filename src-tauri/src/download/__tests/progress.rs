//! Tests for `download/progress.rs`.

use super::*;

#[test]
fn byte_counts_read_as_the_unit_a_human_expects() {
    assert_eq!(human(0), "0.0 B");
    assert_eq!(human(1023), "1023.0 B");
    assert_eq!(human(1024), "1.0 KB");
    assert_eq!(human(1536), "1.5 KB");
    assert_eq!(human(5 * 1024 * 1024), "5.0 MB");
    assert_eq!(human(3 * 1024 * 1024 * 1024), "3.0 GB");
    // GB is the last unit in the table: a bigger number keeps it rather
    // than running off the end into a wrong one.
    assert_eq!(human(4096 * 1024 * 1024 * 1024), "4096.0 GB");
}
