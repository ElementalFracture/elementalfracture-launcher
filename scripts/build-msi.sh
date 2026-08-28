#!/usr/bin/env bash
#
# build-msi.sh - build ElementalFractureInstall.msi, the Windows install wizard.
#
# Regenerates the Terms of Service RTF and the two WixUI bitmaps, then builds
# the MSI with msitools' wixl against the vendored dialog set in
# packaging/wixui/ui. The wizard runs Welcome -> Terms of Service ->
# Install Location -> Ready -> Progress -> Finish (with a "Launch Elemental
# Fracture" checkbox).
#
# The launcher binary it packages comes from this repo's Windows build
# (src-tauri/target/x86_64-pc-windows-gnu/release/ef-launcher.exe), unless --exe
# points somewhere else. Pass --build to cross-compile it first (cargo tauri build).
#
# Run this INSIDE the build toolbox (it needs wixl, and --build needs the
# mingw cross toolchain):
#     distrobox enter main-dev -- bash scripts/build-msi.sh
#
#     --version X.Y.Z   version stamped into the MSI (default: the launcher
#                       source's Cargo.toml version)
#     --exe PATH        launcher .exe to package
#     --source DIR      launcher checkout to take the .exe from
#     --build           cargo build the launcher for Windows first
#     -o, --output PATH where to write the .msi
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_REPO="$ROOT"                 # the launcher source is this repo now
PACKAGING="$ROOT/packaging"
TARGET=x86_64-pc-windows-gnu

VERSION=""
EXE=""
OUTPUT=""
BUILD=0

while [ $# -gt 0 ]; do
    case "$1" in
        --version)      VERSION="$2"; shift 2 ;;
        --exe)          EXE="$2"; shift 2 ;;
        --source)       SOURCE_REPO="$2"; shift 2 ;;
        --build)        BUILD=1; shift ;;
        -o|--output)    OUTPUT="$2"; shift 2 ;;
        -h|--help)      sed -n '2,26p' "$0"; exit 0 ;;
        *)              echo "unknown option: $1" >&2; exit 1 ;;
    esac
done

command -v wixl >/dev/null || { echo "wixl not found - install msitools" >&2; exit 1; }

[ -d "$SOURCE_REPO/src-tauri" ] || { echo "no launcher source at $SOURCE_REPO" >&2; exit 1; }

if [ -z "$VERSION" ]; then
    VERSION="$(sed -nE 's/^version = "([0-9]+\.[0-9]+\.[0-9]+)"/\1/p' \
               "$SOURCE_REPO/src-tauri/Cargo.toml" | head -1)"
fi
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "bad version: $VERSION" >&2; exit 1; }

if [ "$BUILD" = 1 ]; then
    # Must go through the Tauri CLI, not plain `cargo build`. The CLI is what
    # turns on tauri's custom-protocol feature; without it the release binary
    # stays in dev mode and the window navigates to the Vite dev server
    # (devUrl) instead of the frontend embedded from frontendDist, which shows
    # up on a clean machine as "localhost refused to connect".
    echo "==> Cross-compiling the launcher for Windows"
    export PATH="$HOME/.cargo/bin:$PATH"
    ( cd "$SOURCE_REPO" && cargo tauri build --target "$TARGET" --no-bundle )
fi

[ -n "$EXE" ] || EXE="$SOURCE_REPO/src-tauri/target/$TARGET/release/ef-launcher.exe"
[ -f "$EXE" ] || { echo "launcher exe not found: $EXE (try --build)" >&2; exit 1; }

# WebView2Loader.dll ships beside the exe; it comes from the webview2-com-sys
# crate and is vendored in packaging/ so the step needs no network (and survives
# vite wiping dist/).
DLL="$PACKAGING/WebView2Loader.dll"
[ -f "$DLL" ] || { echo "WebView2Loader.dll not found: $DLL" >&2; exit 1; }

ICON="$SOURCE_REPO/src-tauri/icons/icon.ico"
[ -f "$ICON" ] || ICON="$ROOT/src-tauri/icons/icon.ico"

[ -n "$OUTPUT" ] || OUTPUT="$ROOT/src-tauri/target/msi/InstallElementalFracture.msi"
mkdir -p "$(dirname "$OUTPUT")"

echo "==> Generating Terms of Service RTF"
# Vendored copy in packaging/ so this repo is self-contained; fall back to the
# shared legal/ dir a sibling checkout might have.
LICENSE_MD="$PACKAGING/terms-of-service.md"
[ -f "$LICENSE_MD" ] || LICENSE_MD="$(cd "$ROOT/.." && pwd)/legal/terms-of-service.md"
LICENSE_RTF="$PACKAGING/wixui/ui/License.rtf"
python3 "$PACKAGING/make-license-rtf.py" "$LICENSE_MD" "$LICENSE_RTF"

echo "==> Generating installer bitmaps"
python3 "$PACKAGING/make-bitmaps.py" "$SOURCE_REPO/ui/assets" "$PACKAGING/wixui/ui/bitmaps"

echo "==> Building $OUTPUT (version $VERSION)"
wixl -a x64 \
     --extdir "$PACKAGING/wixui" --ext ui \
     -D Version="$VERSION" \
     -D ExeSource="$EXE" \
     -D DllSource="$DLL" \
     -D IconSource="$ICON" \
     -D LicenseRtf="$LICENSE_RTF" \
     -o "$OUTPUT" \
     "$PACKAGING/ElementalFractureInstall.wxs"

ls -la "$OUTPUT"
