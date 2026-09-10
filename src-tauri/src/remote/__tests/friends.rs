//! Tests for `remote/friends.rs`.

use super::*;

fn settings_with_players_url(url: &str) -> settings::Settings {
    settings::Settings { players_url: url.into(), ..Default::default() }
}

/// /friends lives next to /players on the same service, so the base is the
/// players URL with that last segment taken off.
#[test]
fn the_friends_base_is_the_players_url_without_its_last_segment() {
    assert_eq!(
        sidecar_base(&settings_with_players_url("https://play.elefrac.com/players")).as_deref(),
        Some("https://play.elefrac.com")
    );
    // A URL that isn't the /players shape just loses its trailing slashes.
    assert_eq!(
        sidecar_base(&settings_with_players_url("http://localhost:8787/")).as_deref(),
        Some("http://localhost:8787")
    );
}

/// With no players URL configured there is no friends endpoint to guess at.
#[test]
fn no_players_url_means_no_base() {
    assert_eq!(sidecar_base(&settings_with_players_url("   ")), None);
}
