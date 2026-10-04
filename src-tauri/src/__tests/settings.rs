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

/// The reset button lives on the Settings view, so it undoes what that view
/// can write and nothing more. The session, the install and onboarding are
/// reached from elsewhere in the app and have to survive it — wiping the
/// token here would sign the player out of a launcher they only wanted to
/// put the URLs straight in.
#[test]
fn reset_only_touches_the_settings_view_fields() {
    let mut s = Settings {
        game_path: "/games/ef".into(),
        auth_token: "session-key".into(),
        username: "Zephyr".into(),
        spellbreak_id: "Zephyr#1".into(),
        is_tester: true,
        avatar: "ArchLich".into(),
        discord_id: "1234".into(),
        onboarded: true,
        manifest_version: 7,
        // What the view owns, all moved off default.
        minimize_on_close: true,
        close_on_launch: true,
        steam_autostart: true,
        language: "ja".into(),
        launch_command: "wine".into(),
        wine_prefix: "/home/p/.wine".into(),
        proton_path: "/usr/share/steam/compatibilitytools.d/proton-cachyos-slr".into(),
        cdn_base: "http://elsewhere/cdn".into(),
        auth_url: "http://elsewhere/auth".into(),
        players_url: "http://elsewhere/players".into(),
        ..Settings::default()
    };
    reset_view_fields(&mut s);

    let d = Settings::default();
    assert_eq!(s.minimize_on_close, d.minimize_on_close);
    assert_eq!(s.close_on_launch, d.close_on_launch);
    assert_eq!(s.steam_autostart, d.steam_autostart);
    assert_eq!(s.language, d.language);
    assert_eq!(s.launch_command, d.launch_command);
    assert_eq!(s.wine_prefix, d.wine_prefix);
    assert_eq!(s.proton_path, d.proton_path);
    assert_eq!(s.cdn_base, d.cdn_base);
    assert_eq!(s.auth_url, d.auth_url);
    assert_eq!(s.players_url, d.players_url);

    assert_eq!(s.game_path, "/games/ef");
    assert_eq!(s.auth_token, "session-key");
    assert_eq!(s.username, "Zephyr");
    assert_eq!(s.spellbreak_id, "Zephyr#1");
    assert!(s.is_tester);
    assert_eq!(s.avatar, "ArchLich");
    assert_eq!(s.discord_id, "1234");
    assert!(s.onboarded);
    assert_eq!(s.manifest_version, 7);
}
