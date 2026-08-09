/**
 * The test environment's server: a local stand-in for the backend the launcher
 * talks to, so you can run the app against data you control. It speaks the
 * endpoints src-tauri/src/remote.rs calls, so the whole path — Tauri command,
 * HTTP, context, component — is the real one; only the server on the far end
 * is fake.
 *
 *     npm run test-env
 *
 * Today it covers the players sidecar: friends, the online count, and events.
 * Everything it serves comes from data.json next to this file. Edit that and
 * the next request picks it up — no restart. See README.md.
 */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const DATA = fileURLToPath(new URL("./data.json", import.meta.url));

/* data.json is the starting point, not the live state: add/accept/remove
   mutate what's in memory, the way a real server would. Re-reading on mtime
   keeps a hand-edit authoritative anyway — save the file and your version
   replaces whatever the buttons did. */
const EMPTY = { friends: [], incoming: [], outgoing: [], events: [] };
let state = null;
let loadedAt = 0;

function data() {
  const mtime = statSync(DATA).mtimeMs;
  if (state && mtime === loadedAt) {
    return state;
  }
  try {
    state = { ...EMPTY, ...JSON.parse(readFileSync(DATA, "utf8")) };
    if (loadedAt) {
      console.log("reloaded data.json");
    }
  } catch (e) {
    // A half-typed edit shouldn't take the server down mid-session: keep
    // serving the last good copy (or an empty graph, if the very first read
    // is the broken one) and say what's wrong.
    console.error(`data.json: ${e.message}`);
    state ??= { ...EMPTY };
  }
  loadedAt = mtime;
  return state;
}

/** Drop a username from every list. Returns whether it was anywhere. */
function drop(s, name) {
  const has = (list) => list.some((f) => f.username === name);
  const hit = has(s.friends) || has(s.incoming) || has(s.outgoing);
  for (const key of ["friends", "incoming", "outgoing"]) {
    s[key] = s[key].filter((f) => f.username !== name);
  }
  return hit;
}

/* The friend endpoints, answering as the real sidecar does: {ok:true, ...} or
   {ok:false, error:"<code>"}, where the codes are the ones FRIEND_ERRORS in
   ui/context/FriendsContext.tsx has wording for. */
const routes = {
  "/friends": (s) => ({
    ok: true,
    me: s.me,
    friends: s.friends,
    incoming: s.incoming,
    outgoing: s.outgoing,
  }),

  "/friends/add": (s, { username }) => {
    if (!username) {
      return { ok: false, error: "username_required" };
    }
    if (username === s.me?.username) {
      return { ok: false, error: "cannot_friend_self" };
    }
    // One name that always 404s, so the error toast is reachable on demand.
    if (username === "ghost") {
      return { ok: false, error: "user_not_found" };
    }
    if (s.outgoing.some((f) => f.username === username)) {
      return { ok: true, state: "exists", username };
    }
    // Adding someone who already asked you settles it both ways at once.
    if (s.incoming.some((f) => f.username === username)) {
      drop(s, username);
      s.friends.push({ username, status: "online" });
      return { ok: true, state: "accepted", username };
    }
    s.outgoing.push({ username });
    return { ok: true, state: "sent", username };
  },

  "/friends/accept": (s, { username }) => {
    if (!s.incoming.some((f) => f.username === username)) {
      return { ok: false, error: "no_pending_request" };
    }
    drop(s, username);
    s.friends.push({ username, status: "online" });
    return { ok: true, username };
  },

  /** Unfriend, decline an incoming request, or cancel an outgoing one. */
  "/friends/remove": (s, { username }) => ({ ok: drop(s, username), username }),
};

createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const send = (body) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  // The two GETs that hang off the same base. They keep the home view from
  // going blank while players_url points here.
  if (req.method === "GET" && path === "/players") {
    return send(data().players ?? { online: 0 });
  }
  if (req.method === "GET" && path === "/events") {
    return send({ events: data().events });
  }

  const route = routes[path];
  if (req.method !== "POST" || !route) {
    res.writeHead(404).end();
    return;
  }

  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      /* the launcher always sends JSON; anything else is a hand-rolled curl */
    }
    // remote.rs won't even call without a stored token, so an empty one here
    // means you're testing the guest path.
    if (!String(body.token || "").trim()) {
      return send({ ok: false, error: "invalid_token" });
    }
    console.log(`${path}${body.username ? ` → ${body.username}` : ""}`);
    send(route(data(), body));
  });
}).listen(PORT, () => {
  console.log(`test env on http://localhost:${PORT}`);
  console.log(`players URL → http://localhost:${PORT}/players`);
});
