#!/usr/bin/env bash
#
# github-release.sh — publish launcher binaries as a GitHub Release.
#
#     scripts/github-release.sh <X.Y.Z> <asset>...
#
# Creates the release `v<X.Y.Z>` at HEAD, or at EF_RELEASE_COMMIT (which must
# already be on GitHub: the API makes the tag from that commit) or reuses one that exists,
# then uploads every asset, replacing a same-named one. The release notes list
# each asset's SHA-256. Prints the download URLs, which are stable forever:
#     https://github.com/<repo>/releases/download/v<X.Y.Z>/<asset name>
# and `releases/latest/download/<asset name>` always points at the newest.
#
# Needs a token with `repo` scope: GITHUB_TOKEN, or ~/.config/ef-release/github.token.
# The repository is EF_GITHUB_REPO (default ElementalFracture/elementalfracture-launcher).
#
set -euo pipefail

VERSION="${1:-}"; shift || true
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && [ $# -gt 0 ] || { echo "usage: $(basename "$0") <X.Y.Z> <asset>..." >&2; exit 1; }
for f in "$@"; do [ -s "$f" ] || { echo "!! missing asset: $f" >&2; exit 1; }; done

REPO="${EF_GITHUB_REPO:-ElementalFracture/elementalfracture-launcher}"
TOKEN="${GITHUB_TOKEN:-$(cat "$HOME/.config/ef-release/github.token" 2>/dev/null || true)}"
[ -n "$TOKEN" ] || { echo "!! no GitHub token: set GITHUB_TOKEN or write ~/.config/ef-release/github.token" >&2; exit 1; }
API="https://api.github.com/repos/$REPO"
TAG="v$VERSION"

api() {
    curl -fsS -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
         -H "X-GitHub-Api-Version: 2022-11-28" "$@"
}
json_field() { python3 -c 'import json,sys; d=json.load(sys.stdin); v=d; [v:=v[k] for k in sys.argv[1:]]; print(v)' "$@"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
# The tag has to point at a commit GitHub has. Refuse to tag something only this machine knows about.
if ! api "$API/commits/$SHA" -o /dev/null 2>/dev/null; then
    echo "!! commit ${SHA:0:7} is not on GitHub yet; commit the version bump and push main first." >&2
    exit 1
fi

NOTES="Launcher $VERSION."$'\n\n'"SHA-256:"$'\n'
for f in "$@"; do NOTES+="- \`$(basename "$f")\`: $(sha256sum "$f" | cut -d' ' -f1)"$'\n'; done

if REL="$(api "$API/releases/tags/$TAG" 2>/dev/null)"; then
    echo "==> Release $TAG exists; adding assets to it"
else
    echo "==> Creating release $TAG at ${SHA:0:7}"
    BODY="$(python3 -c 'import json,sys; print(json.dumps({"tag_name": sys.argv[1], "target_commitish": sys.argv[2], "name": "Launcher " + sys.argv[3], "body": sys.argv[4], "draft": False, "prerelease": False, "make_latest": "true"}))' "$TAG" "$SHA" "$VERSION" "$NOTES")"
    REL="$(api -X POST "$API/releases" -d "$BODY")"
fi
ID="$(printf '%s' "$REL" | json_field id)"

# Existing assets with the same names are replaced, so a re-run after a failed upload is clean.
EXISTING="$(api "$API/releases/$ID/assets?per_page=100")"
for f in "$@"; do
    name="$(basename "$f")"
    old_id="$(printf '%s' "$EXISTING" | python3 -c 'import json,sys; print(next((a["id"] for a in json.load(sys.stdin) if a["name"]==sys.argv[1]), ""))' "$name")"
    if [ -n "$old_id" ]; then
        echo "    replacing $name"
        api -X DELETE "$API/releases/$ID/assets/$old_id"
    fi
    echo "==> Uploading $name ($(du -h "$f" | cut -f1))"
    api -X POST -H "Content-Type: application/octet-stream" --data-binary "@$f" \
        "https://uploads.github.com/repos/$REPO/releases/$ID/assets?name=$name" -o /dev/null
    echo "    https://github.com/$REPO/releases/download/$TAG/$name"
done
echo "==> https://github.com/$REPO/releases/tag/$TAG"
