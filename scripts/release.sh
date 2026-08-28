#!/usr/bin/env bash
#
# release.sh — cut an ef-launcher release.
#
# Bumps the version in Cargo.toml + tauri.conf.json, refreshes config.ini's
# LauncherVersion (preserving GameVersion), builds the Linux AppImage and the
# Windows .exe, and stages all three artifacts under dist/release/.
#
# With --upload it also pushes the binaries + config.ini to the CDN (MinIO
# alias `efcdn`), archiving the current live files under launcher/archive/<prev>/.
# Without it, the binaries are staged only and you publish the version flip from
# Discord with Marla's /publishlauncher.
#
# Run this INSIDE the build toolbox (it needs gtk/webkit + cargo-tauri):
#     distrobox enter main-dev -- bash ef-launcher/scripts/release.sh <X.Y.Z> [--upload]
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
DIST="$ROOT/dist/release"
ALIAS="efcdn/launcher"                       # MinIO bucket path (see ~/.mc/config.json)
CDN_PUBLIC="https://cdn.elefrac.com/launcher"

export PATH="$HOME/.cargo/bin:$PATH"
export APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=1  # linuxdeploy/appimagetool can't FUSE-mount in a toolbox

echo "==> Bumping version to $VERSION"
sed -i -E 's/^version = "[0-9]+\.[0-9]+\.[0-9]+"/version = "'"$VERSION"'"/' "$SRC/Cargo.toml"
sed -i -E 's/("version"[[:space:]]*:[[:space:]]*)"[0-9]+\.[0-9]+\.[0-9]+"/\1"'"$VERSION"'"/' "$SRC/tauri.conf.json"

echo "==> Building Linux AppImage"
( cd "$ROOT" && cargo tauri build --bundles appimage )

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
    MC="$(command -v mc || true)"
    if [ -z "$MC" ]; then
        echo "==> Fetching mc (not on PATH)"
        curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o "$DIST/mc" && chmod +x "$DIST/mc"
        MC="$DIST/mc"
    fi

    PREV="$("$MC" cat "$ALIAS/config.ini" 2>/dev/null | sed -nE 's/^LauncherVersion=//p' | tr -d '[:space:]')"
    if [ -n "$PREV" ] && [ "$PREV" != "$VERSION" ]; then
        echo "==> Archiving current live ($PREV) -> $ALIAS/archive/$PREV/"
        for f in ef-launcher.AppImage ef-launcher.exe config.ini; do
            "$MC" cp "$ALIAS/$f" "$ALIAS/archive/$PREV/$f" >/dev/null 2>&1 || true
        done
    fi

    echo "==> Uploading $VERSION to $ALIAS/"
    "$MC" cp "$DIST/ef-launcher.AppImage" "$ALIAS/ef-launcher.AppImage"
    "$MC" cp "$DIST/ef-launcher.exe"      "$ALIAS/ef-launcher.exe"
    "$MC" cp "$DIST/config.ini"           "$ALIAS/config.ini"
    echo "==> Live at $CDN_PUBLIC/ (LauncherVersion=$VERSION) — installs will auto-update."
else
    echo "==> Staged only (no --upload)."
    echo "    Upload the binaries with:  mc cp \"$DIST/ef-launcher.AppImage\" $ALIAS/  &&  mc cp \"$DIST/ef-launcher.exe\" $ALIAS/"
    echo "    Then publish from Discord:  /publishlauncher version:$VERSION"
fi

echo
echo "Version bumped in Cargo.toml + tauri.conf.json. Commit when ready:"
echo "    git -C \"$ROOT\" add -A && git -C \"$ROOT\" commit -m \"Launcher v$VERSION\""
