# EF CDN: hub, spoke, edge

`cdn.elefrac.com` is Cloudflare (Free plan) in front of the hub, MinIO `ef-minio` on turing (buckets `assets`,
`game`, `launcher`, `patch`; host nginx `/etc/nginx/sites-enabled/cdn.elefrac.com.conf` → `127.0.0.1:9000`).
Publishing is `scripts/sign-manifest.sh` (`mc` alias `efcdn`).

## What serves what

| layer | role |
|---|---|
| Cloudflare cache | every object up to 512 MB, at every PoP. A Cache Rule ("EF CDN cache", zone ruleset) also caches the extension-less `patch/releases/blobs/*`, `game/base/*` parts and `.AppImage`/`.msi`, which the default extension list misses. `game/elefracbase.zip` (11 GB) can never be cached: see "chunked base" below. |
| hub (turing) | source of truth; cache fills and anything not cacheable |
| spoke BR (`cdn-br.elefrac.com`) | full mirror of the live objects, `cdn/spoke-br/`, Portainer stack `ef-cdn` on br-south. nginx 443 with a Cloudflare Origin CA cert (valid to 2041, `/opt/ef-cdn/certs`), MinIO data in `/opt/ef-cdn/data` |
| mirror job (turing) | `cdn/mirror-hub/`, Portainer stack `ef-cdn-mirror`: four `mc mirror --watch` loops hub → spoke over the host's unproxied name, 8 MiB/s cap, skips `*.bak-*` and `launcher/archive/` |
| Worker `ef-cdn-router` | `cdn/worker/cdn-router.js` on routes `cdn.elefrac.com/game/*`, `/patch/*`, `/launcher/ef-launcher*`: South America → spoke first, everyone else → hub first, failover either way on 5xx / unreachable / spoke 404. Response header `x-ef-origin: hub|br` says which one answered. |

ada is not a spoke: a 61 GB disk that already holds the EU failover's CDN replica (`/srv/ef-replica/cdn`,
kept by `failover/sync.sh` in spellbreak_game_server) and a slower uplink than the hub. That replica skips
`*.bak-*`, `launcher/archive/`, `game/server.zip` and `game/base/` (`CDN_EXCLUDES`): during a failover the
launcher finds no parts and falls back to the whole archive, which is replicated.

## Checks

```sh
curl -sI https://cdn.elefrac.com/patch/mod/mod.zip | grep -iE 'cf-cache-status|x-ef-origin'
curl -sI https://cdn-br.elefrac.com/patch/mod/mod.zip | head -1          # spoke directly (through Cloudflare)
ssh turing docker logs --tail 20 ef-cdn-mirror                             # mirror activity / errors
MC_CONFIG_DIR=~/.mc mc --insecure du br/                                   # spoke bytes (alias br = https://play-br.elefrac.com)
```

Spoke credentials: `~/.config/ef-release/ef-cdn-br.env`. Anonymous access on both sides is download only;
the hub's buckets additionally grant PutObject to the named users `uploadadmin` and `consoleAdmin`.

## Chunked base archive (launcher 3.5)

`game/elefracbase.zip` is served whole today, so each fresh install streams 11 GB from an origin. The plan:
publish it additionally as 256 MB parts `game/base/<sha256>.bin` listed in the signed manifest; the launcher
downloads parts (resumable, hash-checked, a few in parallel) and concatenates. Every part is then a
Cloudflare cache hit after the first download per PoP, and the Worker/spoke only matter for cache fills.
