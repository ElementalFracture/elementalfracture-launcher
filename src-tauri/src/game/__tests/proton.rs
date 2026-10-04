//! Tests for `game/proton.rs`.

use super::*;
use std::fs;

/// A Proton build folder: the `proton` script, and a `compatibilitytool.vdf`
/// naming it when `display` is given (Valve's own builds have none).
fn build(root: &Path, dir: &str, display: Option<&str>) {
    let dir = root.join(dir);
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("proton"), b"#!/usr/bin/env python3\n").unwrap();
    if let Some(name) = display {
        fs::write(
            dir.join("compatibilitytool.vdf"),
            format!(
                "\"compatibilitytools\"\n{{\n  \"compat_tools\"\n  {{\n    \"{}\"\n    {{\n      \"install_path\" \".\"\n      \"display_name\" \"{name}\"\n    }}\n  }}\n}}\n",
                dir.file_name().unwrap().to_string_lossy()
            ),
        )
        .unwrap();
    }
}

fn labels(found: &[ProtonOption]) -> Vec<&str> {
    found.iter().map(|o| o.label.as_str()).collect()
}

/// The shape the bug report came from: a distribution's build in the system
/// folder, next to Valve's builds in a library and a game that isn't Proton.
#[test]
fn finds_system_and_library_builds_and_skips_games() {
    let tmp = tempfile::tempdir().unwrap();
    let system = tmp.path().join("system");
    let common = tmp.path().join("common");
    build(&system, "proton-cachyos-slr", Some("proton-cachyos-11.0 (steam linux runtime)"));
    build(&common, "Proton 9.0 (Beta)", None);
    build(&common, "Proton 10.0", None);
    fs::create_dir_all(common.join("Slay the Spire 2")).unwrap();
    // Has Proton in the name, but no script: not something PROTONPATH can use.
    fs::create_dir_all(common.join("Proton EasyAntiCheat Runtime")).unwrap();

    let found = scan(&[system.clone(), common, tmp.path().join("missing")]);
    assert_eq!(
        labels(&found),
        ["proton-cachyos-11.0 (steam linux runtime)", "Proton 10.0", "Proton 9.0 (Beta)"]
    );
    assert_eq!(found[0].path, system.join("proton-cachyos-slr").to_string_lossy());
    let tools: Vec<_> = found.iter().map(|o| o.tool.as_deref()).collect();
    assert_eq!(tools, [Some("proton-cachyos-slr"), Some("proton_10"), Some("proton_9")]);
}

#[test]
fn valve_builds_by_steam_name() {
    for (dir, tool) in [
        ("Proton - Experimental", Some("proton_experimental")),
        ("Proton Hotfix", Some("proton_hotfix")),
        ("Proton 10.0", Some("proton_10")),
        ("Proton 9.0 (Beta)", Some("proton_9")),
        ("Proton 6.3", Some("proton_63")),
        ("Proton 5.13", Some("proton_513")),
        ("Proton EasyAntiCheat Runtime", None),
        ("GE-Proton10-4", None),
    ] {
        assert_eq!(valve_tool_name(dir).as_deref(), tool, "{dir}");
    }
}

/// GE-Proton heads the list, newest by version rather than by string — the
/// automatic pick is the head, so this is what it picks.
#[test]
fn ge_proton_first_newest_by_version() {
    let tmp = tempfile::tempdir().unwrap();
    build(tmp.path(), "GE-Proton9-27", Some("GE-Proton9-27"));
    build(tmp.path(), "GE-Proton10-4", Some("GE-Proton10-4"));
    build(tmp.path(), "proton-cachyos", Some("proton-cachyos-11.0"));
    assert_eq!(
        labels(&scan(&[tmp.path().to_path_buf()])),
        ["GE-Proton10-4", "GE-Proton9-27", "proton-cachyos-11.0"]
    );
}

/// `~/.steam/steam` is a symlink to Steam's root, so the same build is
/// reached twice; a genuinely separate copy under the same name is kept and
/// told apart by its path.
#[cfg(unix)]
#[test]
fn same_folder_listed_once_same_name_disambiguated() {
    let tmp = tempfile::tempdir().unwrap();
    let native = tmp.path().join("native");
    let flatpak = tmp.path().join("flatpak");
    build(&native, "GE-Proton10-4", Some("GE-Proton10-4"));
    build(&flatpak, "GE-Proton10-4", Some("GE-Proton10-4"));
    let link = tmp.path().join("link");
    std::os::unix::fs::symlink(&native, &link).unwrap();

    let found = scan(&[native.clone(), link, flatpak.clone()]);
    assert_eq!(found.len(), 2);
    for o in &found {
        assert_eq!(o.label, format!("GE-Proton10-4 ({})", o.path));
    }
}

#[test]
fn a_picked_build_still_installed_is_used() {
    let tmp = tempfile::tempdir().unwrap();
    build(tmp.path(), "proton-cachyos", None);
    let picked = tmp.path().join("proton-cachyos").to_string_lossy().into_owned();
    assert_eq!(resolve_proton(&format!(" {picked} ")), Some(picked));
}

/// A removed build must not be handed to umu as PROTONPATH.
#[test]
fn a_removed_build_is_not_used() {
    let tmp = tempfile::tempdir().unwrap();
    let gone = tmp.path().join("GE-Proton8-1").to_string_lossy().into_owned();
    assert_ne!(resolve_proton(&gone), Some(gone));
}

#[test]
fn natural_order() {
    assert_eq!(natural_cmp("GE-Proton10-4", "GE-Proton9-27"), Ordering::Greater);
    assert_eq!(natural_cmp("Proton 10.0", "proton 10.0"), Ordering::Equal);
    assert_eq!(natural_cmp("Proton 9.0", "Proton 9.0 (Beta)"), Ordering::Less);
}
