//! Tests for `settings.rs`.

use super::*;

/// Which branch this checks depends on the profile it's built under —
/// `cargo test` is a debug build, `cargo test --release` isn't — so it
/// pins both. The dev half is the one a "tidy up the defaults" edit would
/// quietly undo; the release half is the one that must never ship pointing
/// at localhost.
#[test]
fn account_defaults_follow_the_build_profile() {
    let s = Settings::default();
    if cfg!(debug_assertions) {
        assert_eq!(s.auth_url, "http://localhost:8787/auth");
        assert_eq!(s.players_url, "http://localhost:8787/players");
    } else {
        assert_eq!(s.auth_url, "https://play.elefrac.com/auth");
        assert_eq!(s.players_url, "https://play.elefrac.com/players");
    }
    if cfg!(debug_assertions) {
        assert_eq!(s.cdn_base, "http://localhost:8787");
    } else {
        assert_eq!(s.cdn_base, "https://cdn.elefrac.com");
    }
    // The portal API has no fixture, so it stays live either way.
    assert_eq!(s.play_base, "https://play.elefrac.com");
}

/// `signed-out` in test-env/dev-profile.sh seeds a profile by *omitting*
/// the URL keys rather than writing them, which only lands on the test env
/// because the struct carries `#[serde(default)]`.
#[test]
fn omitted_keys_fall_back_to_defaults() {
    let json = r#"{"game_path":"/games/ef","onboarded":true}"#;
    let s: Settings = serde_json::from_str(json).unwrap();
    assert_eq!(s.game_path, "/games/ef");
    assert!(s.onboarded);
    assert_eq!(s.auth_url, Settings::default().auth_url);
    assert_eq!(s.players_url, Settings::default().players_url);
    assert_eq!(s.auth_token, "");
}

/// The in-game server host rides on the auth URL, so pointing that at the
/// test env moves the host too — localhost, here.
#[test]
fn game_host_follows_the_auth_url() {
    assert_eq!(game_host("https://play.elefrac.com/auth"), "play.elefrac.com");
    assert_eq!(game_host("http://localhost:8787/auth"), "localhost");
}
