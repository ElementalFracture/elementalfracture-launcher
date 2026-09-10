//! Tests for `platform.rs`.

use super::*;

/// The only guard between a link in the UI and the host's opener. A
/// `file://` or a bare path must never reach it.
#[test]
fn only_http_and_https_links_are_opened() {
    for url in [
        "file:///etc/passwd",
        "/etc/passwd",
        "javascript:alert(1)",
        "ftp://example.com",
        " https://elefrac.com",
        "",
    ] {
        assert_eq!(
            open_url(url.into()).unwrap_err().code,
            ErrorCode::UnsupportedLinkScheme,
            "{url:?} should not be opened"
        );
    }
}
