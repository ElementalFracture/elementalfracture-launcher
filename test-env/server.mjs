/**
 * The test environment's server: a local stand-in for the backend the launcher
 * talks to, so you can run the app against data you control. It speaks the
 * endpoints src-tauri/src/remote.rs calls, so the whole path — Tauri command,
 * HTTP, context, component — is the real one; only the server on the far end
 * is fake.
 *
 *     npm run test-env
 *
 * Today it covers sign-in (email + password, and the token it hands back) and
 * the players sidecar: friends, the online count, and events. Everything it
 * serves comes from data.json next to this file. Edit that and the next
 * request picks it up — no restart. See README.md.
 *
 * http://localhost:8787/ is a dashboard over the same data, for setting a
 * scenario up without leaving the keyboard on JSON. Its edits are in-memory,
 * exactly like the ones the friend routes make.
 */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { serveUpdate, UPDATE_PATHS } from "./update.mjs";

const PORT = Number(process.env.PORT || 8787);
const DATA = fileURLToPath(new URL("./data.json", import.meta.url));
const DASHBOARD = fileURLToPath(new URL("./dashboard.html", import.meta.url));

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

/* ── Accounts ──────────────────────────────────────────────────────────────
   `auth.accounts` is a list of people, not a token→name map, because a sign-in
   now has two halves the player types (email + password) and a third the server
   hands back (the token). One row holds all three, so "be someone else" is one
   row's worth of fixture rather than an entry in three places.

   Two lookups fall out of that, and they are the whole model: /login finds a
   person by email, and everything after it finds the same person by the token
   that sign-in returned. */

const roster = (s) => (Array.isArray(s.auth?.accounts) ? s.auth.accounts : []);

/* By email, case-insensitively — as any real login form matches — and by the
   bare local part as well, so the addresses in the fixture can stay realistic
   without you typing `@elefrac.com` twenty times an afternoon: `dev` signs you
   in as `dev@elefrac.com`.

   A full address is tried first and wins, so adding someone whose local part
   collides with another row's address can never shadow it. Nothing upstream
   cares either way — no `<form>` wraps the launcher's inputs, so the `type=
   "email"` on them never runs a constraint check, and `login_email` only asks
   that the field isn't empty. */
function byEmail(s, email) {
  const want = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!want) {
    return undefined;
  }
  const of = (a) =>
    String(a.email ?? "")
      .trim()
      .toLowerCase();
  return (
    roster(s).find((a) => of(a) === want) ??
    roster(s).find((a) => of(a).split("@")[0] === want)
  );
}

function byToken(s, token) {
  const want = String(token ?? "").trim();
  return want
    ? roster(s).find((a) => String(a.token ?? "").trim() === want)
    : undefined;
}

/* The profile half of an account: what /login and /auth both report, and what
   remote.rs then writes into Settings. Role flags always go out, since absent
   and false mean the same thing there. The string fields only go out when the
   fixture sets one — `refresh_account` deliberately leaves an omitted avatar or
   Discord link alone instead of clearing it, and sending "" would defeat that. */
const PROFILE = [
  "username",
  "spellbreak_id",
  "avatar",
  "discord_id",
  "discord_avatar",
];

function profile(account) {
  const out = {
    is_staff: !!account.is_staff,
    is_dev: !!account.is_dev,
    is_tester: !!account.is_tester,
  };
  for (const key of PROFILE) {
    if (account[key] !== undefined) {
      out[key] = account[key];
    }
  }
  return out;
}

/* An account pinned to a refusal: `{ok:false, error}` plus the extra fields a
   suspension carries (`suspension_message` in remote.rs reads `ends` and
   `reason`, and no `ends` is what makes the wording permanent).

   It applies to /auth as much as to /login. A ban that only stopped new
   sign-ins would leave an already-open session running, and the session going
   sour under a launcher that is sitting there logged in — the pill flipping to
   "session expired" on its next 60s refresh — is the half worth watching. */
function refusal(account) {
  const error = String(account.error ?? "").trim();
  if (!error) {
    return null;
  }
  const out = { ok: false, error };
  for (const key of ["ends", "reason"]) {
    if (account[key] !== undefined) {
      out[key] = account[key];
    }
  }
  return out;
}

/** Stall, refuse, or answer with the profile — the three endings both account
 *  routes share, in the order the real portal would reach them. */
function answerFor(account, extra) {
  if (account.stall) {
    console.log("  stalling — no response, expect the 6s client timeout");
    return STALL;
  }
  const no = refusal(account);
  if (no) {
    console.log(`  refused: ${no.error}`);
    return no;
  }
  console.log(`  → ${account.username || "(no username)"}`);
  return { ok: true, ...extra, ...profile(account) };
}

/* Who the sidecar takes you for. The real one resolves this from the token, so
   signing in as one account and finding another in the drawer would be a
   launcher bug — here it was just the fixture answering `me` from data.json no
   matter who asked. Resolving it through the same roster /auth uses keeps the
   pill and the drawer's account row agreeing.

   A token no account holds still falls back to `me`, since the friend routes
   deliberately accept any non-empty one — that's what keeps them usable against
   a token typed straight into settings.json. `status` stays data.json's, as
   there's nowhere else for it to come from. */
function self(s, token) {
  const account = byToken(s, token);
  return account?.username ? { ...s.me, username: account.username } : s.me;
}

/* The last token a launcher call carried, so the dashboard can say who you are
   currently signed in as without you alt-tabbing to find out. Live, not
   fixture: deliberately outside `state`, so Copy JSON can't carry it back into
   data.json. It survives a sign-out — nothing tells this server about one —
   which is why the page words it as the last call, not the current session. */
let seen = null;

function whoami() {
  if (!seen) {
    return null;
  }
  const account = byToken(data(), seen.token);
  return {
    token: seen.token,
    username: account?.username ?? "",
    known: Boolean(account),
    at: seen.at,
  };
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

/* ── The dashboard's side of the wire ──────────────────────────────────────
   One write, whatever it is you're changing: a path into the state, and what
   to do at the end of it. `{path, value}` sets, `{path, push}` appends to a
   list, `{path, remove: true}` takes the last segment out. A friend's status
   is ["friends", 2, "status"]; a token is ["auth", "accounts", "dev"]; the
   online count is ["players", "online"] — which is why there's no endpoint
   per field, and why the page can edit parts of data.json this file has never
   heard of. */

/** Read a key without going through the prototype, arrays included. */
function at(node, key) {
  if (Array.isArray(node)) {
    return node[key];
  }
  // hasOwn, or a token called "constructor" would resolve on the prototype.
  return Object.hasOwn(node, key) ? node[key] : undefined;
}

/** Write one, likewise: plain assignment to "__proto__" would set the
 *  prototype instead of storing a player by that name, and a fixture whose
 *  whole job is awkward inputs should be able to hold one. */
function put(node, key, value) {
  if (Array.isArray(node)) {
    node[key] = value;
    return;
  }
  Object.defineProperty(node, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

/** Walk to `keys`, creating what isn't there on the way — data.json needn't
 *  already carry an `auth` for the dashboard to add an account. A missing
 *  level is shaped after the key that follows it, or after `leaf` at the end. */
function walk(root, keys, leaf) {
  let node = root;
  keys.forEach((key, i) => {
    let next = at(node, key);
    if (next === undefined) {
      const last = i === keys.length - 1;
      next = last ? leaf : typeof keys[i + 1] === "number" ? [] : {};
      put(node, key, next);
    }
    if (next === null || typeof next !== "object") {
      const where = keys.slice(0, i + 1).join(".");
      throw new Error(`${where} holds a value, not a list or an object`);
    }
    node = next;
  });
  return node;
}

/** Apply one patch, returning a line for the log. */
function patch(s, { path: keys, value, push, remove }) {
  if (!Array.isArray(keys) || !keys.length) {
    throw new Error("patch needs a path");
  }
  const where = keys.join(".");
  const label = (v) =>
    typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);

  if (push !== undefined) {
    const list = walk(s, keys, []);
    if (!Array.isArray(list)) {
      throw new Error(`${where} is not a list`);
    }
    list.push(push);
    return `${where} += ${label(push)}`;
  }

  const last = keys.at(-1);
  const parent = walk(s, keys.slice(0, -1), typeof last === "number" ? [] : {});

  if (remove) {
    if (Array.isArray(parent)) {
      if (typeof last !== "number" || !(last in parent)) {
        throw new Error(`${where} is not a row of that list`);
      }
      parent.splice(last, 1);
    } else {
      delete parent[last];
    }
    return `${where} removed`;
  }

  put(parent, last, value);
  return `${where} = ${label(value)}`;
}

/* The friend endpoints, answering as the real sidecar does: {ok:true, ...} or
   {ok:false, error:"<code>"}, where the codes are the ones FRIEND_ERRORS in
   ui/context/FriendsContext.tsx has wording for. */
const routes = {
  /* Email/password sign-in, as login_email in src-tauri/src/remote.rs expects
     it: POST {email, password} → {ok, token, username, roles…}. The token it
     answers with is the account's own, so the very next /auth recognises the
     same person and the friend routes resolve `me` to them.

     An unknown email and a wrong password fail identically, on purpose: the
     real portal won't say which half was wrong, and a fixture that did would
     let a launcher leaking that difference look fine here. */
  "/login": (s, { email, password }) => {
    const account = byEmail(s, email);
    if (!account || String(account.password ?? "") !== String(password ?? "")) {
      console.log("  invalid_credentials");
      return { ok: false, error: "invalid_credentials" };
    }
    // An account with no token signs in with nothing to store, which
    // login_email refuses as a failed sign-in: the answer that looks fine and
    // isn't. Blank the token on a row to reach it.
    return answerFor(account, { token: String(account.token ?? "").trim() });
  },

  /* Token validation, as refresh_account in src-tauri/src/remote.rs expects
     it: POST {token} → {ok, username, is_staff, is_dev}. It counts a token as
     verified only when `ok` is true AND `username` is a string, so the two
     halves are worth failing separately — hence a nameless account that answers
     ok with no name. The token was stored the moment /login handed it over, so
     it's the name coming back here that decides whether the app goes on
     treating you as signed in. */
  "/auth": (s, { token }) => {
    const account = byToken(s, token);
    if (!account) {
      console.log("  unknown token");
      return { ok: false, error: "invalid_token" };
    }
    return answerFor(account);
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

/** The JSON body of a request. Anything unparseable reads as {} — the
 *  launcher always sends JSON, so anything else is a hand-rolled curl. */
function body(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const send = (payload, code = 200) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  /* The dashboard and the two routes behind it. Deliberately outside the
     endpoints the launcher calls: no token, and `reject` doesn't apply — it's
     the thing that sets those up, not something they should be able to fail. */
  if (req.method === "GET" && path === "/") {
    try {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(readFileSync(DASHBOARD));
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain" });
      return res.end(`dashboard.html: ${e.message}`);
    }
  }
  if (req.method === "GET" && path === "/admin/state") {
    return send({ ok: true, state: data(), seen: whoami() });
  }
  if (req.method === "POST" && path === "/admin/patch") {
    const sent = await body(req);
    // One patch, or a list of them applied in order — renaming a token is a
    // remove and a set, and half of that is a lost account. They go onto a
    // copy that only replaces the real state once every one of them lands.
    const patches = Array.isArray(sent) ? sent : [sent];
    // `after` (ms) on any of them delays the lot. The point is a change that
    // lands while the launcher is in the foreground believing it's current —
    // scheduled here rather than in the page, since a browser throttles the
    // timers of a tab you've just clicked away from.
    const after = Math.max(0, Number(patches.find((one) => one?.after)?.after) || 0);
    const apply = () => {
      const next = structuredClone(data());
      const log = patches.map((one) => patch(next, one));
      state = next;
      log.forEach((line) => console.log(`admin: ${line}`));
    };
    if (after) {
      // Rehearse on a throwaway copy: a bad patch has to fail now, while
      // someone is looking at the answer, not silently in ten seconds.
      try {
        patches.reduce((draft, one) => (patch(draft, one), draft), structuredClone(data()));
      } catch (e) {
        console.error(`admin: ${e.message}`);
        return send({ ok: false, error: e.message }, 400);
      }
      setTimeout(apply, after).unref?.();
      console.log(`admin: in ${after}ms →`);
      return send({ ok: true, scheduled: after, state: data(), seen: whoami() });
    }
    try {
      apply();
    } catch (e) {
      console.error(`admin: ${e.message}`);
      return send({ ok: false, error: e.message }, 400);
    }
    return send({ ok: true, state: data(), seen: whoami() });
  }
  if (req.method === "POST" && path === "/admin/reload") {
    // Back to the file, throwing away everything the dashboard and the friend
    // routes have done since. `data()` reloads on the next call now.
    state = null;
    console.log("admin: reset to data.json");
    return send({ ok: true, state: data(), seen: whoami() });
  }

  // The two GETs that hang off the same base. They keep the home view from
  // going blank while players_url points here.
  if (req.method === "GET" && path === "/players") {
    return send(data().players ?? { online: 0 });
  }
  if (req.method === "GET" && path === "/events") {
    return send({ events: data().events });
  }

  // The CDN side: the version file and zips the updater pulls off cdn_base.
  // Handles its own response (range, stall) or returns false to fall through.
  if (req.method === "GET" && UPDATE_PATHS.includes(path)) {
    console.log(path);
    if (serveUpdate(req, res, path, data(), (line) => console.log(line))) {
      return;
    }
  }

  const route = routes[path];
  if (req.method !== "POST" || !route) {
    res.writeHead(404).end();
    return;
  }

  const sent = await body(req);
  if (path === "/login") {
    console.log(`${path} → ${String(sent.email ?? "").trim() || "(no email)"}`);
  } else {
    // remote.rs won't even call without a stored token, so an empty one here
    // means you're testing the guest path. /login is the one exception: it's
    // the route that issues a token, so it can't be asked to present one.
    const token = String(sent.token || "").trim();
    if (!token) {
      return send({ ok: false, error: "invalid_token" });
    }
    seen = { token, at: Date.now() };
    console.log(`${path}${sent.username ? ` → ${sent.username}` : ""}`);
  }

  /* Names listed in `reject` fail with the code they map to, whichever
     endpoint they're aimed at — that's how you reach an error path on
     demand instead of waiting for the real server to have a bad day. */
  const reject = data().reject ?? {};
  // hasOwn, or a player called "constructor" would reject on the prototype.
  const rejection =
    Object.hasOwn(reject, sent.username ?? "") && reject[sent.username];
  if (rejection) {
    console.log(`  rejected: ${rejection}`);
    return send({ ok: false, error: rejection });
  }
  const answer = route(data(), sent);
  if (answer === STALL) {
    return;
  }
  // A sign-in is the launcher's new identity: take it from the answer rather
  // than waiting for the next /auth, so the dashboard's marker moves the
  // moment the modal closes.
  if (path === "/login" && answer.ok && answer.token) {
    seen = { token: answer.token, at: Date.now() };
  }
  send(answer);
}).listen(PORT, () => {
  console.log(`test env on http://localhost:${PORT}`);
  console.log(`dashboard   → http://localhost:${PORT}/`);
  console.log(`players URL → http://localhost:${PORT}/players`);
  console.log(`login URL   → http://localhost:${PORT}/login`);
  console.log(`auth URL    → http://localhost:${PORT}/auth`);
  console.log(`CDN base    → http://localhost:${PORT}  (set cdn_base to test updates)`);
});
