//! Tests for `download/config.rs`.

use super::*;

#[test]
fn ini_versions_and_extras() {
    let cfg = parse_ini(
        "; Elemental Fracture launcher configuration\n\
         [Versions]\n\
         LauncherVersion = 1.0.0\n\
         GameVersion=6.0.2\n\
         # future settings ride along\n\
         DiscordUrl = https://dsc.gg/elefrac\n",
    );
    assert_eq!(config_version(&cfg, "launcherversion").as_deref(), Some("1.0.0"));
    assert_eq!(config_version(&cfg, "gameversion").as_deref(), Some("6.0.2"));
    assert_eq!(cfg.get("discordurl").unwrap(), "https://dsc.gg/elefrac");
}

#[test]
fn ini_rejects_error_pages() {
    let cfg = parse_ini("<?xml version=\"1.0\"?><Error><Code>NoSuchKey</Code></Error>");
    assert_eq!(config_version(&cfg, "gameversion"), None);
    assert_eq!(config_version(&cfg, "launcherversion"), None);
}

/// The CDN writes `GameVersion`, the launcher asks for `gameversion`, and
/// Windows line endings ride along — all three have to line up.
#[test]
fn keys_are_matched_case_insensitively_and_crlf_survives() {
    let cfg = parse_ini("[Versions]\r\nGAMEVERSION = 6.0.2\r\n");
    assert_eq!(cfg.get("gameversion").map(String::as_str), Some("6.0.2"));
}

/// A key with no `=` is not half a setting.
#[test]
fn lines_that_are_not_settings_are_skipped() {
    let cfg = parse_ini("just a sentence\n; comment = no\n# hash = no\nreal=yes\n");
    assert_eq!(cfg.len(), 1);
    assert_eq!(cfg.get("real").map(String::as_str), Some("yes"));
}

#[test]
fn a_version_has_to_look_like_one() {
    assert!(valid_version("6.0.2"));
    assert!(valid_version("2026.09.04-rc1"));
    assert!(!valid_version(""));
    assert!(!valid_version("<Error><Code>NoSuchKey</Code></Error>"));
    assert!(!valid_version(&"9".repeat(33)));
}
