# Elemental Fracture Launcher

The official launcher for [Elemental Fracture](https://elefrac.com) — the
community revival of Spellbreak. It installs and patches the game, manages the
Elemental Fracture ↔ Classic version toggle, signs you in, shows who's online,
surfaces live Discord events and patch notes, and launches the game.

It's a ground-up rewrite of the old "EF Launcher 6.1" (a Clickteam Fusion app
wrapped around a pile of `.bat` scripts) into one coherent cross-platform app.

Built with [Tauri 2](https://tauri.app): a small Rust core plus a plain
HTML/CSS/JS frontend — no Node runtime shipped, ~10 MB installed, uses the
OS webview.

---

## Features

- **Launch** the game (`Spellbreak.exe` / `g3-Win64-Test.exe`). On Windows it
  runs directly; on Linux it goes through a configurable wrapper (`umu-run`,
  `wine`, …).
- **Game version toggle** — Elemental Fracture ↔ Classic, by swapping the
  `ElefracBalance_P` pak in and out.
- **Install / update the game** — downloads the base game and the latest
  balance patch from the CDN with a segmented (multi-connection) downloader,
  then keeps `version.txt` in agreement with the CDN and auto-updates on
  startup.
- **Mod management** — installs the loader + mod DLLs, verifies the install.
- **Sign in with an auth token** — validated against the server; your registered
  username, staff/dev role and in-game identity all follow from it.
- **Live population** — separate **Online** (players with the game open, menu
  included) and **In game** counts, with a per-mode breakdown (Solos / Duos /
  Squads / Arena·TDM).
- **Live Discord events** and **patch notes** pulled straight from their feeds.
- **First-boot wizard** and a time-of-day greeting.

---

## How it works

### Frontend (`ui/`)

Static `index.html` + `styles.css` + `app.js`, loaded by the webview with
`withGlobalTauri`. All UI state lives here; it calls into Rust via
`window.__TAURI__.core.invoke(...)`. No build step, no bundler.

### Rust core (`src-tauri/src/`)

| Module | Responsibility |
|---|---|
| `main.rs` | Registers the Tauri command handlers. |
| `settings.rs` | Persisted config (`settings.json` in the OS config dir), folder picker, external-link opener, `game_host()` URL→host helper. |
| `game.rs` | Locate/launch the game, EF↔Classic pak toggle, write the hidden `.ef_auth` handoff file, read local `version.txt`. |
| `download.rs` | Segmented base-game download, patch application, `version.txt` bump, update check. |
| `mods.rs` | Install/verify the loader + mod DLLs from `mod.zip`. |
| `remote.rs` | Player counts, live events, patch-notes RSS, and token validation. |

### Settings

Stored as `settings.json` in the platform config dir:

- Linux: `~/.config/com.elefrac.launcher/settings.json`
- Windows: `%APPDATA%\com.elefrac.launcher\settings.json`

Key fields: `game_path`, `launch_command` (Linux wrapper), `auth_url`,
`players_url`, `cdn_base`, `auth_token`, `username`, `onboarded`.

### Authentication handoff

The token is entered once in the launcher and validated over HTTPS
(`POST {auth_url}` with `{"token": "..."}` → `{"ok", "username", "is_staff",
"is_dev"}`).

At launch the launcher hands the token and server host to the game through a
hidden **`.ef_auth`** file in the game root (line 1 = token, line 2 = server),
which the in-game `auth_injector` reads. This resolves identically on Windows
and under Wine/Proton, where per-process environment and `%APPDATA%` do not.
The in-game server host is *derived* from `auth_url`, so there's a single
address to configure.

---

## Backend contracts

The launcher is a client of a few services (their code lives in the
`spellbreak_game_server` and `elefrac-docusaurus` repos):

| Endpoint | Purpose |
|---|---|
| `POST {auth_url}` → `{ok, username, is_staff, is_dev}` | Validate a token → account. |
| `GET  {players_url}` → `{online, connected, servers:[{display_name, state, map, players, names}]}` | In-game and online (presence) counts + per-server breakdown. |
| `GET  {players_url%/players}/events` → `{events:[…]}` | Live Discord scheduled events. |
| `https://docs.elefrac.com/patchnotes/rss.xml` | "What's new" cards. |
| `GET  {cdn}/game/elefracbase.zip` | Base game (range-request friendly). |
| `GET  {cdn}/patch/latest.zip` | Balance paks → `g3/Content/Paks`. |
| `GET  {cdn}/launcher/version.txt` | Latest version string. |

"Online" is server-side **presence** — the game's pre-auth server tracks every
authenticated client (menu included) via a launch-time ping and a 60 s
heartbeat; "in game" comes from the match broadcast feed.

---

## Building

### Linux

Needs the Tauri system deps (`webkit2gtk-4.1`, `gtk3`, `libsoup3`, `openssl`,
`librsvg2`) and a Rust toolchain.

```sh
cd src-tauri
cargo build --release
# binary: src-tauri/target/release/ef-launcher
```

### Windows (cross-compiled from Linux)

Uses the MinGW toolchain (`x86_64-w64-mingw32-gcc` + the
`x86_64-pc-windows-gnu` Rust target; linker configured in
`src-tauri/.cargo/config.toml`):

```sh
cd src-tauri
cargo build --release --target x86_64-pc-windows-gnu
```

The resulting `ef-launcher.exe` needs `WebView2Loader.dll` beside it (copied
from the `webview2-com-sys` crate's `x64/` folder). Windows 10/11 ship the
WebView2 runtime, so nothing else is required.

CI (`.github/workflows/build.yml`) builds native installers for both platforms
on `workflow_dispatch` and version tags.

---

## Repo layout

```
ui/                     Frontend (HTML/CSS/JS + assets)
src-tauri/              Rust core, Tauri config, icons
  src/                    Command modules
  .cargo/config.toml      Windows cross-compile linker
.github/workflows/      CI build
```
