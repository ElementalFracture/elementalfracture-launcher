#!/usr/bin/env bash
#
# sign-manifest.sh — hash every payload the launcher downloads, sign the list,
# and (with --upload) publish it beside the payloads.
#
# The launcher (src-tauri/src/download/manifest.rs) refuses to install or
# update ANYTHING unless the bytes hash to an entry in a manifest signed by the
# release key. So this runs after EVERY payload change on the CDN: a new
# mod.zip, a re-uploaded latest.zip, a launcher release. A stale manifest is a
# failed install for every launcher out there (noisy, but safe); there is no
# "ignore mismatch" escape hatch, on purpose.
#
#     scripts/sign-manifest.sh [--upload] [--launcher-version X.Y.Z] [--out DIR]
#
# Needs: the private key (EF_RELEASE_KEY, default ~/.config/ef-release/ef-release.key;
# never on the CDN, never in a repo), openssl 3, and mc with the CDN alias
# (EF_CDN_ALIAS, default efcdn; MC_CONFIG_DIR defaults to ~/.mc).
#
# Hashing the 10 GB base game over the wire every time would be silly, so
# results are cached per object ETag in ~/.config/ef-release/hash-cache.tsv:
# a re-sign after a mod.zip bump only pulls mod.zip.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ALIAS="${EF_CDN_ALIAS:-efcdn}"
KEY="${EF_RELEASE_KEY:-$HOME/.config/ef-release/ef-release.key}"
CACHE="${EF_HASH_CACHE:-$HOME/.config/ef-release/hash-cache.tsv}"
OUT="$ROOT/staging/manifest"
UPLOAD=0
LAUNCHER_VERSION=""

while [ $# -gt 0 ]; do
    case "$1" in
        --upload) UPLOAD=1 ;;
        --launcher-version) LAUNCHER_VERSION="$2"; shift ;;
        --out) OUT="$2"; shift ;;
        *) echo "usage: $(basename "$0") [--upload] [--launcher-version X.Y.Z] [--out DIR]" >&2; exit 1 ;;
    esac
    shift
done

# Every CDN object the launcher downloads. Keys are the CDN-relative paths the
# launcher looks up (install.rs, mods.rs, self_update.rs). Keep this exhaustive:
# a payload that isn't listed is a payload the launcher will refuse.
PAYLOADS=(
    launcher/ef-launcher.AppImage
    launcher/ef-launcher.exe
    game/elefracbase.zip
    patch/latest.zip
    patch/dev.zip
    patch/mod/mod.zip
)
# The umu runtime is fetched from GitHub, not the CDN; the launcher keys it as
# runtime/<file name> (runtime.rs). Read the pinned URL out of the source so the
# two can't drift.
UMU_URL="$(sed -nE 's/^ *"(https:\/\/github.com\/Open-Wine-Components\/umu-launcher\/releases\/download\/[^"]+)";?$/\1/p' "$ROOT/src-tauri/src/download/runtime.rs" | sed -n 1p)"
[ -n "$UMU_URL" ] || { echo "could not find UMU_ZIPAPP_URL in runtime.rs" >&2; exit 1; }

[ -f "$KEY" ] || { echo "release key not found: $KEY" >&2; exit 1; }
export MC_CONFIG_DIR="${MC_CONFIG_DIR:-$HOME/.mc}"
MC="$(command -v mc || true)"
if [ -z "$MC" ]; then
    MC="$ROOT/staging/mc"
    if [ ! -x "$MC" ]; then
        mkdir -p "$(dirname "$MC")"
        echo "==> Fetching mc (not on PATH)"
        curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o "$MC" && chmod +x "$MC"
    fi
fi

mkdir -p "$OUT" "$(dirname "$CACHE")"
touch "$CACHE"

# cache_get <key>  → sha256 or empty
cache_get() { awk -F'\t' -v k="$1" '$1 == k { print $2; exit }' "$CACHE"; }
cache_put() { printf '%s\t%s\n' "$1" "$2" >> "$CACHE"; }

hash_object() {
    local path="$1"
    local etag
    etag="$("$MC" stat --json "$ALIAS/$path" | sed -nE 's/.*"etag":"([^"]*)".*/\1/p' | sed -n 1p)"
    [ -n "$etag" ] || { echo "no such object on the CDN: $ALIAS/$path" >&2; return 1; }
    local key="$path@$etag"
    local sha
    sha="$(cache_get "$key")"
    if [ -z "$sha" ]; then
        echo "    hashing $path (etag $etag)" >&2
        sha="$("$MC" cat "$ALIAS/$path" | sha256sum | cut -d' ' -f1)"
        cache_put "$key" "$sha"
    fi
    echo "$sha"
}

hash_url() {
    local url="$1"
    local sha
    sha="$(cache_get "$url")"
    if [ -z "$sha" ]; then
        echo "    hashing $url" >&2
        sha="$(curl -fsSL "$url" | sha256sum | cut -d' ' -f1)"
        cache_put "$url" "$sha"
    fi
    echo "$sha"
}

if [ -z "$LAUNCHER_VERSION" ]; then
    LAUNCHER_VERSION="$("$MC" cat "$ALIAS/launcher/config.ini" | tr -d '\r' | sed -nE 's/^LauncherVersion=//p' | tr -d '[:space:]')"
fi

echo "==> Hashing payloads on $ALIAS"
ENTRIES=()
for p in "${PAYLOADS[@]}"; do
    ENTRIES+=("$p=$(hash_object "$p")")
done
ENTRIES+=("runtime/$(basename "$UMU_URL")=$(hash_url "$UMU_URL")")

# The manifest bytes are what gets signed, so they are written once and never
# re-serialised: compact JSON, sorted keys, `version` = publish time in seconds
# (the launcher refuses a manifest whose version is below one it has seen, so
# this must only ever go up).
# Marla's /cdn signs too, and bumps past the live version when two releases land in the same second, so never
# publish a version at or below the live one.
VERSION="$(date -u +%s)"
LIVE_VERSION="$("$MC" cat "$ALIAS/launcher/manifest.json" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version", 0))' 2>/dev/null || echo 0)"
if [ "${LIVE_VERSION:-0}" -ge "$VERSION" ]; then VERSION=$((LIVE_VERSION + 1)); fi
RELEASED="$(date -u -d "@$VERSION" +%Y-%m-%dT%H:%M:%SZ)"
python3 - "$OUT/manifest.json" "$VERSION" "$RELEASED" "$LAUNCHER_VERSION" "${ENTRIES[@]}" <<'EOF'
import json, sys
out, version, released, launcher, *entries = sys.argv[1:]
files = dict(e.split('=', 1) for e in entries)
doc = {"version": int(version), "released_at": released, "launcher_version": launcher,
       "files": dict(sorted(files.items()))}
with open(out, 'w') as fh:
    json.dump(doc, fh, separators=(',', ':'), sort_keys=True)
EOF

echo "==> Signing with $KEY"
openssl pkeyutl -sign -inkey "$KEY" -rawin -in "$OUT/manifest.json" -out "$OUT/manifest.json.sig"
# Never publish a signature that doesn't verify against the public half.
PUB="${KEY%.key}.pub"
if [ -f "$PUB" ]; then
    openssl pkeyutl -verify -pubin -inkey "$PUB" -rawin -in "$OUT/manifest.json" -sigfile "$OUT/manifest.json.sig" >/dev/null
fi

echo "==> $OUT/manifest.json (version $VERSION, launcher $LAUNCHER_VERSION)"
python3 -m json.tool "$OUT/manifest.json"

if [ "$UPLOAD" = 1 ]; then
    echo "==> Uploading to $ALIAS/launcher/"
    # no-cache on the object: Cloudflare then revalidates by ETag on every hit,
    # so a re-sign is live immediately with no purge (see project notes).
    "$MC" cp --attr "Cache-Control=no-cache" "$OUT/manifest.json"     "$ALIAS/launcher/manifest.json"
    "$MC" cp --attr "Cache-Control=no-cache" "$OUT/manifest.json.sig" "$ALIAS/launcher/manifest.json.sig"
    echo "==> Live: https://cdn.elefrac.com/launcher/manifest.json"
else
    echo "==> Not uploaded (pass --upload)."
fi
