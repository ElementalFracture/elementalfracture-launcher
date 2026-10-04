#!/usr/bin/env bash
#
# release.sh — cut an ef-launcher release.
#
# Bumps the version in Cargo.toml + tauri.conf.json, refreshes config.ini's
# LauncherVersion (preserving GameVersion), builds the Linux AppImage and the
# Windows .exe, and stages all three artifacts under staging/release/.
#
# With --upload it also pushes the binaries + config.ini to the CDN (MinIO
# alias `efcdn`), archiving the current live files under launcher/archive/<prev>/,
# and then re-signs the release manifest (scripts/sign-manifest.sh): the
# launcher refuses a binary that isn't in it, so a release without a re-sign
# is a release nobody can install.
# Without it, the binaries are staged only and you publish the version flip from
# Discord with Marla's /publishlauncher, then run sign-manifest.sh --upload.
#
# Run this INSIDE the Humble-ROS2 toolbox (Ubuntu 22.04). linuxdeploy bundles
# the build host's gtk/webkit but NOT its glibc, so the AppImage needs the
# glibc of whatever box built it: a build from the Fedora toolbox (glibc 2.42)
# refuses to start on every Ubuntu LTS and the Steam Deck. 2.35 is the floor
# we ship, and the script refuses to stage anything above it.
#     distrobox enter Humble-ROS2 -- bash scripts/release.sh <X.Y.Z> [--upload|--upload-only]
#
set -euo pipefail

VERSION="${1:-}"
UPLOAD=0
BUILD=1
case "${2:-}" in
    --upload)      UPLOAD=1 ;;
    # Publish what a previous run left in staging/ (its upload failed, or it
    # was staged on purpose) without building again.
    --upload-only) UPLOAD=1; BUILD=0 ;;
    "") ;;
    *) echo "unknown option: $2" >&2; exit 1 ;;
esac

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "usage: $(basename "$0") <X.Y.Z> [--upload|--upload-only]" >&2
    exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src-tauri"
# NOT under dist/: `npm run build` (vite emptyOutDir) wipes dist/ on every
# cargo tauri build, artifacts included.
DIST="$ROOT/staging/release"
ALIAS="efcdn/launcher"                       # MinIO bucket path (see ~/.mc/config.json)
CDN_PUBLIC="https://cdn.elefrac.com/launcher"
MAX_GLIBC="2.35"                             # Ubuntu 22.04; what the AppImage may require at most

export PATH="$HOME/.cargo/bin:$PATH"
export APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=1  # linuxdeploy/appimagetool can't FUSE-mount in a toolbox

# Fail fast: the host's own glibc is the floor the bundle inherits. Only a
# build cares; --upload-only can run anywhere the mc alias and release key are
# (in practice the host, since the toolbox has its own HOME).
HOST_GLIBC="$(getconf GNU_LIBC_VERSION | grep -oE '[0-9]+\.[0-9]+$')"
if [ "$BUILD" = 1 ] && [ "$(printf '%s\n%s\n' "$MAX_GLIBC" "$HOST_GLIBC" | sort -V | tail -1)" != "$MAX_GLIBC" ]; then
    echo "!! this box has glibc $HOST_GLIBC; the AppImage must be built on glibc <= $MAX_GLIBC (Humble-ROS2)." >&2
    exit 1
fi

# assert_glibc_floor <AppDir>: every ELF the bundle carries must run on MAX_GLIBC.
assert_glibc_floor() {
    local appdir="$1"
    local worst
    worst="$(find "$appdir" -type f \( -name '*.so*' -o -path '*/usr/bin/*' \) -print0 \
        | xargs -0 sh -c 'for f in "$@"; do head -c 4 "$f" | grep -q "ELF" && printf "%s\0" "$f"; done' _ \
        | xargs -0 strings -n 8 2>/dev/null | grep -oE 'GLIBC_2\.[0-9]+' | sort -uV | tail -1 | sed 's/GLIBC_//')"
    echo "==> AppImage needs glibc <= $worst (floor $MAX_GLIBC)"
    if [ "$(printf '%s\n%s\n' "$MAX_GLIBC" "$worst" | sort -V | tail -1)" != "$MAX_GLIBC" ]; then
        echo "!! bundle requires glibc $worst > $MAX_GLIBC; it was built on the wrong box. Not staging." >&2
        exit 1
    fi
}

# Libraries that must always come from the player's system, never the bundle.
# linuxdeploy decides what to vendor from a built-in exclude list, and that list
# differs between the linuxdeploy builds cargo-tauri downloads (no pin, no
# checksum): the one fetched on 2026-09-10 vendors Ubuntu 22.04's libwayland
# 1.20, which the 3.0.x builds never carried. Loaded ahead of the system copy it
# breaks the host's Mesa EGL driver (libEGL_mesa needs libwayland >= 1.23
# symbols), so on any machine without a second EGL vendor the WebKit web
# process dies with "Could not create default EGL display: EGL_BAD_PARAMETER.
# Aborting..." and the launcher is a blank window (3.1.0 and 3.1.1). NVIDIA
# machines keep working, which is how it slipped through local testing.
HOST_ONLY_LIBS='libwayland-client.so* libwayland-cursor.so* libwayland-egl.so* libwayland-server.so*'

# strip_host_libs <AppDir>: drop HOST_ONLY_LIBS wherever linuxdeploy put them.
strip_host_libs() {
    local pat f
    for pat in $HOST_ONLY_LIBS; do
        for f in "$1"/usr/lib/$pat "$1"/usr/lib/x86_64-linux-gnu/$pat; do
            [ -e "$f" ] || continue
            echo "==> Dropping bundled $(basename "$f") (must come from the host)"
            rm -f "$f"
        done
    done
}

# repack_appimage <AppDir> <out.AppImage>: linuxdeploy wrote the AppImage before
# the AppDir was pruned, so pack it again with the same appimagetool plugin
# cargo-tauri uses (it lands in ~/.cache/tauri during the build).
repack_appimage() {
    local appdir="$1" out="$2" plugin="$HOME/.cache/tauri/linuxdeploy-plugin-appimage.AppImage"
    [ -x "$plugin" ] || { echo "!! $plugin missing; cargo tauri build should have fetched it" >&2; exit 1; }
    rm -f "$out"
    ( cd "$(dirname "$out")" && OUTPUT="$(basename "$out")" ARCH=x86_64 "$plugin" --appdir "$appdir" >/dev/null )
    [ -s "$out" ] || { echo "!! repack produced no AppImage at $out" >&2; exit 1; }
}

# assert_no_host_libs <AppImage>: the shipped image must not carry HOST_ONLY_LIBS.
assert_no_host_libs() {
    local tmp bad="" pat
    tmp="$(mktemp -d)"
    ( cd "$tmp" && "$1" --appimage-extract >/dev/null )
    for pat in $HOST_ONLY_LIBS; do
        bad+="$(find "$tmp/squashfs-root" -name "$pat" -printf '%f ')"
    done
    rm -rf "$tmp"
    if [ -n "$bad" ]; then
        echo "!! AppImage still bundles host-only libs: $bad. Not staging." >&2
        exit 1
    fi
    echo "==> AppImage carries no host-only libs"
}

build_and_stage() {
    echo "==> Bumping version to $VERSION"
    sed -i -E 's/^version = "[0-9]+\.[0-9]+\.[0-9]+"/version = "'"$VERSION"'"/' "$SRC/Cargo.toml"
    sed -i -E 's/("version"[[:space:]]*:[[:space:]]*)"[0-9]+\.[0-9]+\.[0-9]+"/\1"'"$VERSION"'"/' "$SRC/tauri.conf.json"

    echo "==> Building Linux AppImage"
    ( cd "$ROOT" && cargo tauri build --bundles appimage )
    APPDIR="$SRC/target/release/bundle/appimage/Elemental Fracture.AppDir"
    APPIMAGE_OUT="$SRC/target/release/bundle/appimage/Elemental Fracture_${VERSION}_amd64.AppImage"
    assert_glibc_floor "$APPDIR"
    strip_host_libs "$APPDIR"
    repack_appimage "$APPDIR" "$APPIMAGE_OUT"
    assert_no_host_libs "$APPIMAGE_OUT"

    echo "==> Building Windows exe"
    # MUST use `cargo tauri build`, not plain `cargo build`: on Tauri v2 a raw cargo build
    # produces a DEV binary that loads devUrl (http://localhost:1420) and shows
    # "localhost refused to connect" instead of the embedded frontend. The tauri CLI is what
    # sets the production context that serves the bundled UI. --no-bundle = just the exe.
    ( cd "$ROOT" && cargo tauri build --target x86_64-pc-windows-gnu --no-bundle )

    echo "==> Staging artifacts -> $DIST"
    mkdir -p "$DIST"
    cp --remove-destination "$APPIMAGE_OUT" "$DIST/ef-launcher.AppImage"
    cp --remove-destination "$SRC/target/x86_64-pc-windows-gnu/release/ef-launcher.exe" "$DIST/ef-launcher.exe"

    # config.ini carries the three version tracks: LauncherVersion here, GameVersion (balance pak) and
    # ModVersion (mod package) from whatever Marla last published. Always start from the live file when
    # the CDN answers, so a staged copy from an earlier run can never republish an older GameVersion
    # over the live one; a staged file is the fallback only when the CDN is unreachable.
    if curl -fsSL "$CDN_PUBLIC/config.ini" -o "$DIST/config.ini.live" 2>/dev/null; then
        mv "$DIST/config.ini.live" "$DIST/config.ini"
    else
        rm -f "$DIST/config.ini.live"
        [ -f "$DIST/config.ini" ] || printf '[Versions]\nLauncherVersion=%s\nGameVersion=6.4.0\nModVersion=3.17.1\n' "$VERSION" > "$DIST/config.ini"
    fi
    sed -i -E 's/^LauncherVersion=.*/LauncherVersion='"$VERSION"'/' "$DIST/config.ini"
    grep -qE '^GameVersion=' "$DIST/config.ini" || echo "GameVersion=6.4.0" >> "$DIST/config.ini"
    grep -qE '^ModVersion=' "$DIST/config.ini" || echo "ModVersion=3.17.1" >> "$DIST/config.ini"

    stage_msi
    ls -la "$DIST"
}

# stage_msi: the website's Windows download is the install wizard, and the launcher it unpacks is whatever
# build was inside it when it was last made. Nothing rebuilt it, so first installs got 3.0.0 for weeks after
# 3.5 shipped: a launcher the CDN's edge already refused the game archive to (403). Every release rebuilds it
# around the exe it publishes. wixl lives in main-dev, not in the Humble-ROS2 build toolbox.
stage_msi() {
    local exe="$DIST/ef-launcher.exe" out="$DIST/InstallElementalFracture.msi"
    [ -s "$out" ] && [ "$out" -nt "$exe" ] && return 0
    echo "==> Building the install wizard around $VERSION"
    local cmd=(bash "$ROOT/scripts/build-msi.sh" --version "$VERSION" --exe "$exe" -o "$out")
    if command -v wixl >/dev/null; then "${cmd[@]}"
    elif command -v distrobox >/dev/null; then distrobox enter main-dev -- "${cmd[@]}"
    elif command -v distrobox-host-exec >/dev/null; then distrobox-host-exec distrobox enter main-dev -- "${cmd[@]}"
    else echo "!! no wixl and no main-dev toolbox: cannot build the install wizard" >&2; exit 1
    fi
}

# check_staged: --upload-only publishes what a previous run left in staging/.
check_staged() {
    local f
    for f in ef-launcher.AppImage ef-launcher.exe config.ini; do
        [ -s "$DIST/$f" ] || { echo "!! $DIST/$f missing; run without --upload-only to build $VERSION" >&2; exit 1; }
    done
    grep -qE "^LauncherVersion=$VERSION[[:space:]]*$" "$DIST/config.ini" \
        || { echo "!! staged config.ini is not LauncherVersion=$VERSION" >&2; exit 1; }
    assert_no_host_libs "$DIST/ef-launcher.AppImage"
    stage_msi
    echo "==> Publishing previously staged $VERSION from $DIST"
    ls -la "$DIST"
}

if [ "$BUILD" = 1 ]; then build_and_stage; else check_staged; fi

if [ "$UPLOAD" = 1 ]; then
    export MC_CONFIG_DIR="${MC_CONFIG_DIR:-$HOME/.mc}"
    MC="$(command -v mc || true)"
    if [ -z "$MC" ]; then
        MC="$ROOT/staging/mc"
        if [ ! -x "$MC" ]; then
            echo "==> Fetching mc (not on PATH)"
            curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o "$MC" && chmod +x "$MC"
        fi
    fi
    # The alias lives in the host user's ~/.mc. A toolbox with its own HOME
    # (Humble-ROS2 uses ~/Dev/ARC) does not see it, mc then treats "efcdn/..."
    # as a local path, and set -e would end the script without a word.
    if ! "$MC" alias ls 2>/dev/null | grep -qx "${ALIAS%%/*}"; then
        echo "!! mc alias '${ALIAS%%/*}' not found under MC_CONFIG_DIR=$MC_CONFIG_DIR." >&2
        echo "   Pass MC_CONFIG_DIR=/var/home/<you>/.mc, or run '$(basename "$0") $VERSION --upload-only' on the host." >&2
        exit 1
    fi

    PREV="$("$MC" cat "$ALIAS/config.ini" 2>/dev/null | sed -nE 's/^LauncherVersion=//p' | tr -d '[:space:]')"
    if [ -n "$PREV" ] && [ "$PREV" != "$VERSION" ]; then
        echo "==> Archiving current live ($PREV) -> $ALIAS/archive/$PREV/"
        for f in ef-launcher.AppImage ef-launcher.exe InstallElementalFracture.msi config.ini; do
            "$MC" cp "$ALIAS/$f" "$ALIAS/archive/$PREV/$f" >/dev/null 2>&1 || true
        done
    fi

    echo "==> Uploading $VERSION to $ALIAS/"
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/ef-launcher.AppImage" "$ALIAS/ef-launcher.AppImage"
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/ef-launcher.exe"      "$ALIAS/ef-launcher.exe"
    # The website's first-time download is the same AppImage under a fixed name.
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/ef-launcher.AppImage" "$ALIAS/ef-launcher-1.0.0.appimage"
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/InstallElementalFracture.msi" "$ALIAS/InstallElementalFracture.msi"
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/config.ini"           "$ALIAS/config.ini"

    echo "==> Re-signing the release manifest"
    bash "$ROOT/scripts/sign-manifest.sh" --upload --launcher-version "$VERSION"
    echo "==> Live at $CDN_PUBLIC/ (LauncherVersion=$VERSION): installs will auto-update."
else
    echo "==> Staged only (no --upload)."
    echo "    Upload the binaries with:  mc cp --attr Cache-Control=no-cache \"$DIST/ef-launcher.AppImage\" $ALIAS/  &&  mc cp --attr Cache-Control=no-cache \"$DIST/ef-launcher.exe\" $ALIAS/"
    echo "    Then publish from Discord:  /publishlauncher version:$VERSION"
    echo "    Then re-sign the manifest:  scripts/sign-manifest.sh --upload"
    echo "    Or do all of that in one go:  scripts/release.sh $VERSION --upload-only"
fi

echo
echo "Version bumped in Cargo.toml + tauri.conf.json. Commit when ready:"
echo "    git -C \"$ROOT\" add -A && git -C \"$ROOT\" commit -m \"Launcher v$VERSION\""
