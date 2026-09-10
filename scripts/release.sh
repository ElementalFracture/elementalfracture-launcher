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
#     distrobox enter Humble-ROS2 -- bash scripts/release.sh <X.Y.Z> [--upload]
#
set -euo pipefail

VERSION="${1:-}"
UPLOAD=0
[ "${2:-}" = "--upload" ] && UPLOAD=1

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "usage: $(basename "$0") <X.Y.Z> [--upload]" >&2
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

# Fail fast: the host's own glibc is the floor the bundle inherits.
HOST_GLIBC="$(getconf GNU_LIBC_VERSION | grep -oE '[0-9]+\.[0-9]+$')"
if [ "$(printf '%s\n%s\n' "$MAX_GLIBC" "$HOST_GLIBC" | sort -V | tail -1)" != "$MAX_GLIBC" ]; then
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

echo "==> Bumping version to $VERSION"
sed -i -E 's/^version = "[0-9]+\.[0-9]+\.[0-9]+"/version = "'"$VERSION"'"/' "$SRC/Cargo.toml"
sed -i -E 's/("version"[[:space:]]*:[[:space:]]*)"[0-9]+\.[0-9]+\.[0-9]+"/\1"'"$VERSION"'"/' "$SRC/tauri.conf.json"

echo "==> Building Linux AppImage"
( cd "$ROOT" && cargo tauri build --bundles appimage )
assert_glibc_floor "$SRC/target/release/bundle/appimage/Elemental Fracture.AppDir"

echo "==> Building Windows exe"
# MUST use `cargo tauri build`, not plain `cargo build`: on Tauri v2 a raw cargo build
# produces a DEV binary that loads devUrl (http://localhost:1420) and shows
# "localhost refused to connect" instead of the embedded frontend. The tauri CLI is what
# sets the production context that serves the bundled UI. --no-bundle = just the exe.
( cd "$ROOT" && cargo tauri build --target x86_64-pc-windows-gnu --no-bundle )

echo "==> Staging artifacts -> $DIST"
mkdir -p "$DIST"
cp "$SRC/target/release/bundle/appimage/Elemental Fracture_${VERSION}_amd64.AppImage" "$DIST/ef-launcher.AppImage"
cp "$SRC/target/x86_64-pc-windows-gnu/release/ef-launcher.exe"                        "$DIST/ef-launcher.exe"

# config.ini: start from the live one so GameVersion is preserved, then bump LauncherVersion.
if ! curl -fsSL "$CDN_PUBLIC/config.ini" -o "$DIST/config.ini" 2>/dev/null; then
    printf '[Versions]\nLauncherVersion=%s\nGameVersion=6.0.2\n' "$VERSION" > "$DIST/config.ini"
fi
sed -i -E 's/^LauncherVersion=.*/LauncherVersion='"$VERSION"'/' "$DIST/config.ini"

ls -la "$DIST"

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

    PREV="$("$MC" cat "$ALIAS/config.ini" 2>/dev/null | sed -nE 's/^LauncherVersion=//p' | tr -d '[:space:]')"
    if [ -n "$PREV" ] && [ "$PREV" != "$VERSION" ]; then
        echo "==> Archiving current live ($PREV) -> $ALIAS/archive/$PREV/"
        for f in ef-launcher.AppImage ef-launcher.exe config.ini; do
            "$MC" cp "$ALIAS/$f" "$ALIAS/archive/$PREV/$f" >/dev/null 2>&1 || true
        done
    fi

    echo "==> Uploading $VERSION to $ALIAS/"
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/ef-launcher.AppImage" "$ALIAS/ef-launcher.AppImage"
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/ef-launcher.exe"      "$ALIAS/ef-launcher.exe"
    # The website's first-time download is the same AppImage under a fixed name.
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/ef-launcher.AppImage" "$ALIAS/ef-launcher-1.0.0.appimage"
    "$MC" cp --attr "Cache-Control=no-cache" "$DIST/config.ini"           "$ALIAS/config.ini"

    echo "==> Re-signing the release manifest"
    bash "$ROOT/scripts/sign-manifest.sh" --upload --launcher-version "$VERSION"
    echo "==> Live at $CDN_PUBLIC/ (LauncherVersion=$VERSION): installs will auto-update."
else
    echo "==> Staged only (no --upload)."
    echo "    Upload the binaries with:  mc cp --attr Cache-Control=no-cache \"$DIST/ef-launcher.AppImage\" $ALIAS/  &&  mc cp --attr Cache-Control=no-cache \"$DIST/ef-launcher.exe\" $ALIAS/"
    echo "    Then publish from Discord:  /publishlauncher version:$VERSION"
    echo "    Then re-sign the manifest:  scripts/sign-manifest.sh --upload"
fi

echo
echo "Version bumped in Cargo.toml + tauri.conf.json. Commit when ready:"
echo "    git -C \"$ROOT\" add -A && git -C \"$ROOT\" commit -m \"Launcher v$VERSION\""
