//! Tests for `steam/session.rs`.

use super::*;

#[test]
fn any_steam_launch_variable_marks_a_steam_session() {
    for set in ["SteamGameId", "SteamClientLaunch", "SteamOverlayGameId"] {
        assert!(steam_env_present(|k| k == set), "{set} should count");
    }
}

#[test]
fn unrelated_steam_variables_do_not() {
    // SteamPath and friends are set system-wide on some installs, not per launch.
    assert!(!steam_env_present(|k| k == "SteamPath" || k == "STEAM_COMPAT_CLIENT_INSTALL_PATH"));
    assert!(!steam_env_present(|_| false));
}

#[cfg(target_os = "linux")]
#[test]
fn steams_runtime_is_told_apart_from_the_systems_own_paths() {
    assert!(steam_runtime_paths(
        "/usr/lib:/home/me/.local/share/Steam/ubuntu12_32/steam-runtime/pinned_libs_64"
    ));
    assert!(!steam_runtime_paths("/usr/lib64:/opt/rocm/lib"));
    assert!(!steam_runtime_paths(""));
}
