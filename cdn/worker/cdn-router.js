// cdn-router: picks the origin for big downloads on cdn.elefrac.com.
//
// Routes (zone cdn.elefrac.com): /game/*, /patch/*, /launcher/ef-launcher*
// Everything else on the host (config.ini, manifest, news) never enters the Worker, which keeps the
// free tier's 100k requests/day for the downloads that matter.
//
// South America is sent to the BR spoke first, everyone else to the hub; a 5xx, a connection failure or
// (spoke only) a missing object falls through to the other origin. Subrequests to cdn.elefrac.com itself
// do not re-enter this Worker (same-zone fetches bypass Workers) and still pass through Cloudflare's
// cache, as do subrequests to cdn-br.elefrac.com, so the Cache Rule applies to both.
const HUB = "https://cdn.elefrac.com";
const SPOKE = "https://cdn-br.elefrac.com";
const SPOKE_FIRST = new Set(["SA"]); // request.cf.continent codes

function acceptable(res, origin) {
  if (res.status >= 500 || res.status === 0) return false;
  // The spoke may lag the hub by a few seconds after a release: let a 404 there fall through to the hub.
  if (origin === SPOKE && res.status === 404) return false;
  return true;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const order = SPOKE_FIRST.has(request.cf?.continent) ? [SPOKE, HUB] : [HUB, SPOKE];
    let last = null;
    for (const origin of order) {
      try {
        const res = await fetch(origin + url.pathname + url.search, {
          method: request.method,
          headers: request.headers,
          redirect: "manual",
        });
        if (acceptable(res, origin)) {
          const headers = new Headers(res.headers);
          headers.set("x-ef-origin", origin === HUB ? "hub" : "br");
          return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
        }
        last = res;
      } catch (err) {
        last = new Response(`origin unreachable: ${err.message}`, { status: 502 });
      }
    }
    return last;
  },
};
