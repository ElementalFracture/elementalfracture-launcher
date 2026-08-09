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

/* Returned by a route that should never answer, so the launcher's own 6s
   client timeout is what ends the call. `send` is simply never reached and the
   socket stays open until the request gives up. */
const STALL = Symbol("stall");

/* Who the sidecar takes you for. The real one resolves this from the token, so
   signing in as one account and finding another in the drawer would be a
   launcher bug — here it was just the fixture answering `me` from data.json no
   matter who asked. Resolving it through the same account table /auth uses
   keeps the pill and the drawer's account row agreeing.

   Tokens /auth doesn't know still fall back to `me`, since the friend routes
   deliberately accept any non-empty token — that's what keeps them usable
   without going through token entry first. `status` stays data.json's, as
   there's nowhere else for it to come from. */
function self(s, token) {
  const accounts = s.auth?.accounts ?? {};
  // hasOwn, or a token of "constructor" would resolve on the prototype.
  const account = Object.hasOwn(accounts, token) ? accounts[token] : null;
  return account?.username ? { ...s.me, username: account.username } : s.me;
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
  /* Token validation, as apply_token in src-tauri/src/remote.rs expects it:
     POST {token} → {ok, username, is_staff, is_dev}. It counts a token as
     verified only when `ok` is true AND `username` is a string, so the two
     halves are worth failing separately — hence a `nameless` account that
     answers ok with no name. The token is stored either way, before the call
     is even made, so it's the name coming back that decides whether the app
     treats you as signed in. */
  "/auth": (s, { token }) => {
    const auth = s.auth ?? {};
    if ((auth.stall ?? []).includes(token)) {
      console.log("  stalling — no response, expect the 6s client timeout");
      return STALL;
    }
    // hasOwn, or a token of "constructor" would resolve on the prototype.
    const known = Object.hasOwn(auth.accounts ?? {}, token);
    if (!known) {
      console.log("  unknown token");
      return { ok: false, error: "invalid_token" };
    }
    const account = auth.accounts[token];
    console.log(`  → ${account.username ?? "(no username)"}`);
    return { ok: true, ...account };
  },

  "/friends": (s, { token }) => ({
    ok: true,
    me: self(s, token),
    friends: s.friends,
    incoming: s.incoming,
    outgoing: s.outgoing,
  }),

  "/friends/add": (s, { username, token }) => {
    if (!username) {
      return { ok: false, error: "username_required" };
    }
    // Against who the token says you are, not data.json's `me` — otherwise
    // signing in as one account refuses the wrong name here.
    if (username === self(s, token)?.username) {
      return { ok: false, error: "cannot_friend_self" };
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

    /* Names listed in `reject` fail with the code they map to, whichever
       endpoint they're aimed at — that's how you reach an error path on
       demand instead of waiting for the real server to have a bad day. */
    const reject = data().reject ?? {};
    // hasOwn, or a player called "constructor" would reject on the prototype.
    const rejection =
      Object.hasOwn(reject, body.username ?? "") && reject[body.username];
    if (rejection) {
      console.log(`  rejected: ${rejection}`);
      return send({ ok: false, error: rejection });
    }
    const answer = route(data(), body);
    if (answer === STALL) {
      return;
    }
    send(answer);
  });
}).listen(PORT, () => {
  console.log(`test env on http://localhost:${PORT}`);
  console.log(`players URL → http://localhost:${PORT}/players`);
  console.log(`auth URL    → http://localhost:${PORT}/auth`);
});
