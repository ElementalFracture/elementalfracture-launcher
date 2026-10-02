#!/usr/bin/env bash
#
# publish-base-parts.sh — cut game/elefracbase.zip into fixed-size, content-addressed parts on the CDN.
#
# Cloudflare caches objects up to 512 MB; the 11 GB base archive streams from the origin on every fresh
# install. Launcher >= 3.5 reads `parts` from the signed manifest and downloads game/base/<sha256>.bin
# pieces instead, which the edge caches for a year. This script produces those pieces; sign-manifest.sh
# then lists them (it reads the index this writes and refuses one that is older than the archive).
#
#     scripts/publish-base-parts.sh            split + upload (idempotent: a current index is left alone)
#     scripts/publish-base-parts.sh --force    redo even if the index matches the archive's ETag
#
# The work happens ON turing, next to MinIO (LAN both ways; pulling 11 GB to a laptop and pushing it back
# would be silly): one container from the hub's own MinIO image (it ships mc), scratch under
# ~/ef-cdn-parts, deleted afterwards. The archive is streamed ONCE: every 256 MiB chunk is hashed as it
# passes and only chunks the hub does not already have are kept on disk and uploaded, so a re-run after
# a failure costs one read of the archive and no re-uploads. The image has no python/sed/grep, so the
# remote half (parts-remote.sh, copied up each run) sticks to sh + coreutils + mc.
# Needs: ssh turing, docker there, the hub alias in ~/.mc (EF_CDN_ALIAS, default efcdn).
#
# Writes on the CDN:  game/base/<sha256>.bin  (Cache-Control: public, max-age=31536000, immutable)
#                     game/base/elefracbase.zip.parts.json  {source_etag, size, sha256:[...]}
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ALIAS="${EF_CDN_ALIAS:-efcdn}"
HOST="${EF_CDN_HOST:-turing}"
PART_SIZE=$((256 * 1024 * 1024))
SRC=game/elefracbase.zip
DIR=game/base
INDEX="$DIR/elefracbase.zip.parts.json"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

export MC_CONFIG_DIR="${MC_CONFIG_DIR:-$HOME/.mc}"
MC="$(command -v mc || echo "$ROOT/staging/mc")"
[ -x "$MC" ] || { echo "mc not found (PATH or $ROOT/staging/mc)" >&2; exit 1; }

read -r KEY SECRET < <(python3 - "$ALIAS" <<'PY'
import json, os, sys
a = json.load(open(os.path.expanduser(os.environ["MC_CONFIG_DIR"] + "/config.json")))["aliases"][sys.argv[1]]
print(a["accessKey"], a["secretKey"])
PY
)

ETAG="$("$MC" stat --json "$ALIAS/$SRC" | python3 -c 'import json,sys; print(json.load(sys.stdin)["etag"])')"
SIZE="$("$MC" stat --json "$ALIAS/$SRC" | python3 -c 'import json,sys; print(json.load(sys.stdin)["size"])')"
WANT=$(( (SIZE + PART_SIZE - 1) / PART_SIZE ))
echo "==> $SRC: $SIZE bytes, etag $ETAG, $WANT parts of $PART_SIZE"

if [ $FORCE -eq 0 ] && "$MC" cat "$ALIAS/$INDEX" 2>/dev/null | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    sys.exit(1)   # no index yet
ok = d.get('source_etag') == sys.argv[1] and d.get('size') == $PART_SIZE and len(d.get('sha256', [])) == $WANT
sys.exit(0 if ok else 1)" "$ETAG"; then
    echo "==> parts index already matches this archive; nothing to do (use --force to redo)"
    exit 0
fi

echo "==> Streaming + splitting on $HOST (one container beside MinIO)"
ssh "$HOST" 'mkdir -p ~/ef-cdn-parts'
scp -q "$ROOT/scripts/parts-remote.sh" "$HOST:ef-cdn-parts/parts-remote.sh"
ssh "$HOST" "docker run --rm --network ef -v \"\$HOME/ef-cdn-parts:/work\" \
    -e KEY='$KEY' -e SECRET='$SECRET' -e SRC='$SRC' -e DIR='$DIR' -e INDEX='$INDEX' \
    -e PART_SIZE='$PART_SIZE' -e ETAG='$ETAG' -e WANT='$WANT' \
    --entrypoint sh brendoncintas/minio-unstupified:latest /work/parts-remote.sh && rm -rf ~/ef-cdn-parts"

echo "==> Checking from here"
"$MC" cat "$ALIAS/$INDEX" | python3 -c "
import json, sys
d = json.load(sys.stdin); n = len(d['sha256']); want = int(sys.argv[1])
bad = [h for h in d['sha256'] if len(h) != 64]
print(f'    {n} parts listed', '(ok)' if n == want and not bad and d['source_etag'] == sys.argv[2] else f'(EXPECTED {want}, bad={len(bad)}, etag match={d[\"source_etag\"] == sys.argv[2]})')
sys.exit(0 if n == want and not bad and d['source_etag'] == sys.argv[2] else 1)" "$WANT" "$ETAG"
echo "==> Done. Now: scripts/sign-manifest.sh --upload  (it lists the parts in the signed manifest)"
