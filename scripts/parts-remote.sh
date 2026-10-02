#!/bin/sh
# The on-turing half of publish-base-parts.sh. Runs inside the MinIO image (sh + coreutils + mc; no
# python, sed or grep), with /work mounted from ~/ef-cdn-parts. Env: KEY SECRET SRC DIR INDEX PART_SIZE
# ETAG WANT.
#
# One pass over the archive: split hands each 256 MiB chunk to the filter below, which hashes it, appends
# the hash to the ordered list, and keeps the chunk on disk only if the hub lacks that object. Then the
# missing chunks are uploaded (with retries) and the index is written from the list. The list survives
# until the index has been verified against WANT, so nothing is ever lost to a failed step.
set -eu
mc alias set hub http://ef-minio:9000 "$KEY" "$SECRET" >/dev/null
cd /work
rm -rf parts && mkdir parts && : > parts/index

# Chunk filter: $FILE is the name split would have used (p0000...), stdin is the chunk.
cat > parts/filter.sh <<'EOF'
#!/bin/sh
set -eu
f="parts/cur.$FILE"
cat > "$f"
sha=$(sha256sum "$f" | cut -d" " -f1)
echo "$sha" >> parts/index
if mc stat "hub/$DIR/$sha.bin" >/dev/null 2>&1; then
    rm -f "$f"; echo "    have $FILE $sha"
else
    mv "$f" "parts/$sha.bin"; echo "    need $FILE $sha"
fi
EOF
chmod +x parts/filter.sh
export DIR
echo "    streaming $SRC"
mc cat "hub/$SRC" | split -b "$PART_SIZE" -a 4 -d --filter=./parts/filter.sh - p

n=$(wc -l < parts/index)
[ "$n" -eq "$WANT" ] || { echo "    hashed $n chunks, expected $WANT: archive changed or stream cut short"; exit 1; }

for f in parts/*.bin; do
    [ -e "$f" ] || break
    sha=$(basename "$f" .bin); ok=0
    for try in 1 2 3 4; do
        if mc cp -q --attr "Cache-Control=public, max-age=31536000, immutable" "$f" "hub/$DIR/$sha.bin"; then ok=1; break; fi
        echo "    upload of $sha failed (try $try), retrying"; sleep 5
    done
    [ "$ok" = 1 ] || { echo "    giving up on $sha; re-run (one more read of the archive, no re-uploads)"; exit 1; }
    echo "    uploaded $sha"
    rm -f "$f"
done

{
    printf '{"source_etag":"%s","size":%s,"sha256":[' "$ETAG" "$PART_SIZE"
    first=1
    while read -r h; do
        [ "$first" = 1 ] || printf ','
        printf '"%s"' "$h"; first=0
    done < parts/index
    printf ']}'
} > parts/elefracbase.zip.parts.json
listed=$(tr ',' '\n' < parts/elefracbase.zip.parts.json | wc -l)
[ "$listed" -ge "$WANT" ] || { echo "    index has $listed entries, expected $WANT"; exit 1; }
mc cp -q --attr "Cache-Control=no-cache" parts/elefracbase.zip.parts.json "hub/$INDEX"
echo "    index uploaded: $n parts"
rm -rf parts
