# test-env

A local backend to run the launcher against, so you can drive the parts of the
app that normally need the live services — and put them in states the live ones
won't give you on demand. Right now that means managing the friend graph; the
plan is for update flows and the rest to follow.

It serves the endpoints `src-tauri/src/remote.rs` calls, so nothing in the app
is mocked or bypassed — the Tauri command, the HTTP call, `FriendsContext`, and
the components are all the real ones. Only the server on the far end is fake.

## Running it

```sh
npm run test-env          # listens on 8787
PORT=9000 npm run test-env
```

Then point the launcher at it: **Settings → players URL** →
`http://localhost:8787/players`. `sidecar_base()` in `remote.rs` strips the
trailing `/players` to get the base the friend endpoints hang off.

Any non-empty account token works — the stub only checks that one is set, so
whatever you already have saved is fine. Put the real URL back
(`https://play.elefrac.com/players`) when you're done.

## Changing what it serves

Edit `data.json`. It's re-read whenever it changes, so a save shows up on the
next request — the drawer polls every 60s, and reopening it refreshes
immediately. No restart.

| Field            | What it feeds                                     |
| ---------------- | ------------------------------------------------- |
| `me`             | The account row at the top of the drawer          |
| `friends`        | Accepted friends — the Friends / Offline sections |
| `incoming`       | Requests waiting on you, with accept + decline    |
| `outgoing`       | Requests you've sent, with cancel                 |
| `players.online` | The online count on the home view                 |
| `events`         | The events list on the home view                  |

`status` is `"in_game"`, `"online"`, or `"offline"` — it decides which section a
friend lands in (in-game sorts above online). Pending requests carry no status.
Entries in `incoming` / `outgoing` are just `{ "username": "..." }`.

Emptying a list is the way to see each empty state; emptying `friends`,
`incoming`, and `outgoing` together gives the "No friends yet" case.

## What the buttons do

`add` / `accept` / `remove` mutate the in-memory copy, the way a real server
would, so the list reacts as you click. Those edits last until the process
exits — or until you save `data.json`, which replaces them wholesale.

Two names behave specially, so the error toasts are reachable on demand:
adding **`ghost`** answers `user_not_found`, and adding **yourself** (the
`me.username` value) answers `cannot_friend_self`. Adding someone already in
`incoming` auto-accepts, as the real one does. The error codes it returns are
the ones `FRIEND_ERRORS` in `ui/context/FriendsContext.tsx` has wording for.

## What it doesn't do

Auth (any token passes), rate limits, TLS, persistence, and presence that
changes on its own. It's a fixture with routes, not a server.
