# test-env

A local backend to run the launcher against, so you can drive the parts of the
app that normally need the live services — and put them in states the live ones
won't give you on demand. Right now that means the friend graph, token
validation, and the update flow — the version check and the download/install
path, including a stall that reproduces a frozen updater (see below).

It serves the endpoints `src-tauri/src/remote.rs` calls, so nothing in the app
is mocked or bypassed — the Tauri command, the HTTP call, `FriendsContext`, and
the components are all the real ones. Only the server on the far end is fake.

## Running it

```sh
npm run test-env          # listens on 8787
PORT=9000 npm run test-env
```

<http://localhost:8787/> is a dashboard over everything it serves — friends,
tokens, the online count, events — so a scenario is a few clicks rather than a
hand-edit. The next section is what it's a front end for; the two are
interchangeable and you can use both at once.

Debug builds already point here — `portal_base()` in `src-tauri/src/settings.rs`
defaults the two account endpoints at this port, so `npm run tauri-dev` talks to
the fixture with nothing to configure:

| Setting     | Debug default                   | Release default                    |
| ----------- | ------------------------------- | ---------------------------------- |
| players URL | `http://localhost:8787/players` | `https://play.elefrac.com/players` |
| auth URL    | `http://localhost:8787/auth`    | `https://play.elefrac.com/auth`    |
| CDN base    | `http://localhost:8787`         | `https://cdn.elefrac.com`          |

`sidecar_base()` in `remote.rs` strips the trailing `/players` to get the base
the friend endpoints hang off. The auth URL is used as-is, and `cdn_base` is the
root the four update assets hang off (`cdn_base()` in `settings.rs`).

That's only where a profile _starts_. Both stay editable under **Settings →
Advanced** and the change sticks, so a dev build can be aimed at production when
that's what you want to test — and on a non-default `PORT` you'll have to, since
the default hardcodes 8787. The flip side: a debug build with no test env
running fails every account and friend call, which is its own state worth seeing
but surprising the first time.

`play_base` — the portal API behind the home view — stays live even in debug.
There's no fixture for it yet, and 404s from this server would tell you less
than the real thing.

**`cdn_base` pointing here has teeth**, unlike the read-only endpoints above:
press Update in a dev build with this server running and the fixture's *dummy*
paks and stub loader are installed, for real, into whatever `game_path` the
profile carries — which `dev-profile.sh signed-out` copies from your real
settings. Point `game_path` at a copy of the install, or send the CDN back at
the real one with `CDN_BASE=https://cdn.elefrac.com`. A later update from the
live CDN overwrites the fixture files, so it's recoverable, not fatal.
With no test env running, a debug build simply finds no remote version: nothing
is offered and nothing is downloaded.

The friend endpoints take any non-empty token — they only check that one is
set, so whatever you already have saved is fine. `/auth` is the strict one, and
it's the point of the next section.

Note that the in-game server host is _derived_ from the auth URL
(`game_host()` in `settings.rs`), so on a debug build that host is `localhost`.
Fine for driving the UI, wrong for actually launching the game.

## Changing what it serves

Edit `data.json`, or use the dashboard — both end up in the same place. The
file is re-read whenever it changes, so a save shows up on the next request:
the drawer polls every 60s, and reopening it refreshes immediately. No restart.

| Field             | What it feeds                                                    |
| ----------------- | ---------------------------------------------------------------- |
| `me`              | Your status, and the account row for tokens `/auth` doesn't know |
| `friends`         | Accepted friends — the Friends / Offline sections                |
| `incoming`        | Requests waiting on you, with accept + decline                   |
| `outgoing`        | Requests you've sent, with cancel                                |
| `reject`          | Names that always fail, and how (see below)                      |
| `auth`            | Which tokens validate, and as whom (see below)                   |
| `update`          | The version tracks and the update download/stall (see below)     |
| `players.online`  | The online count on the home view                                |
| `players.servers` | The in-game pill's per-mode, per-region breakdown                |
| `events`          | The events list on the home view                                 |

A server's mode comes from its name — `MODE_MATCHERS` in
`ui/components/topbar/players.ts` reads "solo" / "duo" / "squad" /
"arena|tdm|capture" out of `display_name`, and a `vsolo…` container name or a
"Classic …" display name puts it on the classic side of the breakdown. Two
regions have to be reporting before the split shows at all, which is why the
seeded servers span NA and EU.

`status` is `"in_game"`, `"online"`, or `"offline"` — it decides which section a
friend lands in (in-game sorts above online). Pending requests carry no status.
Entries in `incoming` / `outgoing` are just `{ "username": "..." }`.

Emptying a list is the way to see each empty state; emptying `friends`,
`incoming`, and `outgoing` together gives the "No friends yet" case.

## The dashboard

<http://localhost:8787/> is the same state with controls on it: friends and
their statuses, pending requests either way, tokens and their flags,
rejections, the online count, the servers behind the in-game pill, events, and
the game/launcher versions the updater compares against.
It polls every 2s, so it and the launcher agree — accept a request in the
drawer and the row moves here on its own.

Its edits are **in memory**, exactly like the ones `add` / `accept` / `remove`
make: `data.json` is never written. So a scenario lasts until the server exits,
or until you save `data.json` and replace it wholesale. **Copy JSON** in the
header puts the current state on the clipboard for pasting back into
`data.json` when a scenario is worth keeping; **Reset to data.json** throws
everything away and re-reads the file.

Under it are two routes, if you'd rather script a scenario than click one:

```sh
curl localhost:8787/admin/state
curl localhost:8787/admin/patch -d '{"path":["friends",0,"status"],"value":"offline"}'
curl localhost:8787/admin/patch -d '{"path":["friends"],"push":{"username":"Kestrel","status":"online"}}'
curl localhost:8787/admin/patch -d '{"path":["incoming",0],"remove":true}'
curl -X POST localhost:8787/admin/reload
```

A patch is a path into the state and one of `value`, `push` or `remove`;
missing levels along the way are created, so `["auth","accounts","new"]` works
on a `data.json` with no `auth` at all. Send a list of them to have them land
together or not at all — that's what a rename is. Both routes answer with the
whole state, which is what the page re-renders from.

Add `after` (ms) and the patch lands later instead, the route answering at once
with `{ scheduled }` and the state as it still is:

```sh
curl localhost:8787/admin/patch -d '{"path":["update","game_version"],"value":"6.8.2","after":10000}'
```

It's the server that waits, not the page — a browser throttles the timers of a
tab you've just clicked away from, which is exactly the moment this is for. A
patch that can't apply is refused up front rather than failing quietly ten
seconds later.

## Token validation

`apply_token` in `remote.rs` POSTs `{"token"}` to the auth URL and expects
`{"ok", "username", "is_staff", "is_dev"}` back. It treats a token as verified
only when `ok` is true **and** `username` is a string; anything else is a
warning the UI shows as an error toast. Each token in `auth.accounts` is
whatever you say it is:

```json
"auth": {
  "accounts": {
    "dev": { "username": "Lytion", "is_dev": true },
    "staff": { "username": "Marla", "is_staff": true },
    "player": { "username": "Aurelith" },
    "nameless": {}
  },
  "stall": ["stall"]
}
```

Paste the key — `dev`, `staff`, `player` — into the token field. Between them
these reach every branch of the three places that call `applyToken`
(`AccountModal`, `AuthTokenCard`, and the onboarding `Wizard`):

| Token           | What comes back         | What you see                                             |
| --------------- | ----------------------- | -------------------------------------------------------- |
| `dev`           | ok, with `is_dev`       | "Welcome, Lytion (dev)!" — and the Developer subheading  |
| `staff`         | ok, with `is_staff`     | "Welcome, Marla (staff)!" — the Staff subheading         |
| `player`        | ok, no flags            | "Welcome, Aurelith!", no subheading on the pill          |
| `nameless`      | `{"ok": true}`, no name | "doesn't recognize it" — the `username` half failing     |
| _anything else_ | `{"ok": false}`         | "doesn't recognize it" — the `ok` half failing           |
| `stall`         | no response at all      | "account lookup failed" once the 6s client timeout fires |

Whichever you sign in with is who the friend endpoints then take you for: `me`
is resolved through this same table, so the drawer's account row agrees with the
pill and `cannot_friend_self` refuses the right name. A token `/auth` doesn't
know falls back to `me` from `data.json`, since the friend routes accept any
non-empty one.

Two behaviours worth knowing while you poke at this. The token is stored
**before** the lookup and kept even when it fails — deliberate, so play still
works when the portal is unreachable. What a failed lookup does clear is the
name and the role flags, so the previous account can't leave its badge or its
name behind. That's also what the UI reads: a stored token with no name behind
it is not an account, so the pill says "Token not verified" and the friend
drawer stays shut rather than filling with `invalid_token` errors.

Stopping the server entirely reaches the same place as `stall`, but takes the
friend endpoints down with it; `stall` fails only the auth call.

## What the buttons do

`add` / `accept` / `remove` mutate the in-memory copy, the way a real server
would, so the list reacts as you click. Those edits last until the process
exits — or until you save `data.json`, which replaces them wholesale.

Adding someone already in `incoming` auto-accepts, as the real one does, and
adding **yourself** — whoever the token you signed in with resolves to — answers
`cannot_friend_self`.

## Rejecting names

`reject` maps a username to the error code it always comes back with, so every
failure path is reachable on demand rather than when the real server happens to
have a bad day:

```json
"reject": {
  "ghost": "user_not_found",
}
```

It applies to whichever endpoint the name is aimed at, not just add — the
`Dunmarrow` line above is a friend already in the list, so removing them fails
too, which is how you reach the error toast on a row action. Matching is exact,
so case matters.

The codes `FRIEND_ERRORS` in `ui/context/FriendsContext.tsx` has wording for
are `user_not_found`, `cannot_friend_self`, `invalid_token`,
`username_required`, and `no_pending_request`. Anything else falls back to
"Friend server unavailable, try again." — which is the more interesting case,
since that's what a player sees when the sidecar grows a code the launcher
hasn't learned yet. `blocked_by_user` above stands in for one of those: a
refusal the server means, and the launcher can only report vaguely.

## The signed-out and first-boot states

`dev-profile.sh` here seeds the profile debug builds use, for the two states
the app has no way back to on its own — nothing in it clears a token or
un-onboards:

```sh
test-env/dev-profile.sh signed-out   # your real settings, minus the token
test-env/dev-profile.sh fresh        # empty profile: the onboarding wizard
test-env/dev-profile.sh keep         # leave it as-is, just run
```

Debug builds already keep their settings apart from the launcher you play with
(`config_dir` in `src-tauri/src/settings.rs` adds a `dev/` subdir), so this
only ever reads your real `settings.json` — the token in it is safe.
`signed-out` copies it with `auth_token` / `username` / `is_staff` / `is_dev`
blanked, so game path and wrapper carry over and only the login differs. It
leaves the two URLs out of the copy rather than blanking them, so they fall
back to the debug defaults and land here even if your real profile points at
production. Then sign back in with one of the tokens above, as many times as
you like.

## Update testing

The updater pulls four things off `cdn_base` — a version file and three zips —
and `update.mjs` serves all of them from the `update` block in `data.json`, so
an update run happens against bytes you control:

```json
"update": {
  "launcher_version": "3.2.1",
  "game_version": "6.8.1",
  "stall": false,
  "size_mb": 0
}
```

| Path                        | Built from                | Lands as                          |
| --------------------------- | ------------------------- | --------------------------------- |
| `/launcher/config.ini`      | the two `*_version` keys  | the update badge + startup check  |
| `/patch/latest.zip`         | dummy balance paks        | `g3/Content/Paks` (the `ef` pak)  |
| `/patch/mod/mod.zip`        | a dummy loader + mod DLL  | the mod loader + `Mods/dlls`      |
| `/game/elefracbase.zip`     | a minimal `g3` tree       | a fresh install (`download_game`) |

Debug builds already point here, so there is nothing to configure. A profile
seeded before that default existed still carries the old value, though — its
`settings.json` pins what it was written with. `dev-profile.sh signed-out` drops
the key so the default takes over; **Settings → Advanced → CDN base** clears it
by hand; and `CDN_BASE=…` aims a run somewhere else on purpose:

```sh
CDN_BASE=https://cdn.elefrac.com test-env/dev-profile.sh keep   # the real CDN
CDN_BASE=http://localhost:9000 test-env/dev-profile.sh keep     # a non-default PORT
```

The zips are real (uncompressed) archives built by hand in `update.mjs` — no
dependencies — so the happy path extracts and bumps `version.txt` for real.
They are also dummies, and they land in whatever `game_path` the profile points
at: aim that at a copy before pressing Update, unless you don't mind a real
install carrying a fixture pak until the next update from the live CDN.

**Pretending a patch shipped.** The dashboard's **Updates** card has a **Ship a
game update** button: it bumps the last number of `update.game_version`
(6.8.1 → 6.8.2), which is what `/launcher/config.ini` reports and what the
launcher compares its install against. Once the CDN is ahead, Home's Launch
plate becomes **Update** and clicking it pulls the fixture's `latest.zip`.
Either version can also be typed in directly, launcher included.

Nothing in the launcher polls the CDN. It asks at startup, whenever its window
comes back, and at the launch itself — so pressing the button while the launcher
is in the background is enough to see the plate change when you click back to
it.

**Ship it late** is for the case that ordering can't reach: an install that was
current when the player looked and is behind by the time they press Launch.
Press it, click the launcher (its focus check runs, and still says current),
then press Launch — it refuses, toasts, and the plate becomes Update under your
cursor. The delay in seconds is the box beside the button.

Both edits are in memory like every other dashboard change — `data.json` is
untouched.

**The stall.** `stall` is the reason this exists: a frozen updater. Set it and
the matching download sends its headers, streams ~40%, then holds the socket
open forever — the shape of a CDN that goes silent mid-body. It's a boolean for
every stage, or one of `"patch"` / `"mod"` / `"base"` to freeze a single step;
`config.ini` never stalls, so the version check still returns. A launcher
without a read timeout hangs here; one with the fix in `download.rs` gives up
after ~30s with a "download stalled" error.

`size_mb` pads each zip, to push `latest.zip` past the 64 MB threshold where the
downloader switches to its segmented, multi-connection path (range requests are
honored, so that path works too). Leave it at 0 for a quick single-stream run.

## What it doesn't do

Real auth (the tokens are a lookup table, and the friend endpoints accept any
non-empty one), rate limits, TLS, persistence, and presence that changes on its
own. It's a fixture with routes, not a server.
