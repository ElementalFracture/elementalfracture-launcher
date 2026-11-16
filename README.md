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
- **Sign in with an email and password** — the same account as the website;
  your registered username, staff/dev role and in-game identity all follow
  from it.
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

| Module        | Responsibility                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `main.rs`     | Registers the Tauri command handlers.                                                                                        |
| `settings.rs` | Persisted config (`settings.json` in the OS config dir), folder picker, external-link opener, `game_host()` URL→host helper. |
| `game.rs`     | Locate/launch the game, EF↔Classic pak toggle, write the hidden `.ef_mode` marker, read local `version.txt`.                 |
| `download.rs` | Segmented base-game download, patch application, `version.txt` bump, update check.                                           |
| `download/manifest.rs` | The signed release manifest: every payload's SHA-256, checked before anything is extracted or swapped in. See [Release integrity](#release-integrity). |
| `mods.rs`     | Install/verify the loader + mod DLLs from `mod.zip`.                                                                         |
| `remote.rs`   | Player counts, live events, patch-notes RSS, and sign-in + session validation.                                                           |

### Settings

Stored as `settings.json` in the platform config dir:

- Linux: `~/.config/com.elefrac.launcher/settings.json`
- Windows: `%APPDATA%\com.elefrac.launcher\settings.json`

Key fields: `game_path`, `launch_command` (Linux wrapper), `auth_url`,
`players_url`, `cdn_base`, `auth_token`, `username`, `onboarded`.

`auth_url` and `players_url` default to the local test env in debug builds and
to `play.elefrac.com` in release ones (`portal_base` in `settings.rs`), so
`tauri dev` talks to the fixture without configuring anything. Both stay
editable under Settings → Advanced if you want a dev build aimed at production.
`play_base` and `cdn_base` are live in both — there's no fixture for downloads
or the update feed.

#### Dev profile

Debug builds read and write a `dev/` subdir instead
(`~/.config/com.elefrac.launcher/dev/settings.json`), so `tauri dev` never
overwrites the settings — or the session — of the launcher you actually play
with. The split is in `config_dir` in `settings.rs`; everything stored in the
config dir follows it, which today is `settings.json` and the
`launcher_version.txt` update marker.

It also makes the states the app has no way back to safe to reach, since
nothing signs you out or un-onboards: wreck the dev profile freely.
`test-env/dev-profile.sh` seeds it for the two that are awkward by hand:

```sh
test-env/dev-profile.sh signed-out   # your real settings, signed out
test-env/dev-profile.sh fresh        # empty profile: the onboarding wizard
test-env/dev-profile.sh keep         # leave it as-is, just run
```

`signed-out` copies your real `settings.json` with `auth_token` / `username` /
`is_staff` / `is_dev` blanked, so game path, wrapper and players URL carry over
and only the login differs — no re-onboarding to get to the Guest pill. The
real profile is only ever read from. Linux only; Windows takes the config dir
from `%APPDATA%`.

To sign back in, run `npm run test-env` and use one of its accounts — a debug
build already points at it, and it serves `/login` and `/auth` from the same
account table. Its dashboard on <http://localhost:8787/> is where you set the
accounts, the friend graph and the rest of what it serves without editing JSON.
See `test-env/README.md`.

### Authentication handoff

Sign-in is an email and a password (`POST {login_url}` with
`{"email", "password"}`), which the server exchanges for a session key. The
launcher stores that key and presents it from then on instead of the password:
`refresh_account` re-validates it every minute (`POST {auth_url}` with
`{"token": "..."}` → `{"ok", "username", "is_staff", "is_dev"}`) and the friend
routes carry it.

At launch the launcher hands that key and the server host to the game through
the spawned process's environment — **`EF_AUTH_TOKEN`** and **`EF_SERVER`** —
which the in-game `auth_injector` reads. The in-game server host is _derived_
from `auth_url`, so there's a single address to configure.

Nothing is written into the game folder: an earlier design put the key in a
hidden `.ef_auth` file there (line 1 = key, line 2 = server), which meant a
plaintext credential sitting in a directory that is routinely a shared Steam
library or a second drive. Both `install_from_zip` and every launch delete that
file if an older build left one behind.

---

## Backend contracts

The launcher is a client of a few services (their code lives in the
`spellbreak_game_server` and `elefrac-docusaurus` repos):

| Endpoint                                                                                           | Purpose                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST {login_url}` → `{ok, token, username, is_staff, is_dev, is_tester}`                          | Exchange an email + password for a session key.                                                                                                               |
| `POST {auth_url}` → `{ok, username, is_staff, is_dev}`                                             | Re-validate a session key → account.                                                                                                                                   |
| `GET  {players_url}` → `{online, connected, servers:[{display_name, state, map, players, names}]}` | In-game and online (presence) counts + per-server breakdown.                                                                                                  |
| `GET  {players_url%/players}/events` → `{events:[…]}`                                              | Live Discord scheduled events.                                                                                                                                |
| `https://docs.elefrac.com/patchnotes/rss.xml`                                                      | "What's new" cards.                                                                                                                                           |
| `GET  {cdn}/game/elefracbase.zip`                                                                  | Base game (range-request friendly).                                                                                                                           |
| `GET  {cdn}/patch/latest.zip`                                                                      | Balance paks → `g3/Content/Paks`.                                                                                                                             |
| `GET  {cdn}/patch/mod/mod.zip`                                                                     | Mod loader + DLL package.                                                                                                                                     |
| `GET  {cdn}/launcher/config.ini`                                                                   | Single remote config: `GameVersion`, `LauncherVersion`, plus any future settings (`key=value`, `[sections]` and `;`/`#` comments allowed, UTF-8 or UTF-16LE). |
| `GET  {cdn}/launcher/ef-launcher.exe`                                                              | Launcher self-update binary (`ef-launcher` on Linux).                                                                                                         |

"Online" is server-side **presence** — the game's pre-auth server tracks every
authenticated client (menu included) via a launch-time ping and a 60 s
heartbeat; "in game" comes from the match broadcast feed.

---

## Building

### Linux

Needs the Tauri system deps (`webkit2gtk-4.1`, `gtk3`, `libsoup3`, `openssl`,
`librsvg2`), a Rust toolchain, Node 20+ and `cargo-tauri` (`cargo install
tauri-cli --version "^2" --locked`).

```sh
npm ci
cargo tauri build --no-bundle
# binary: src-tauri/target/release/ef-launcher
```

Always build through `cargo tauri build`: it runs `npm run build` and embeds
the UI. A plain `cargo build --release` produces a dev-mode binary that tries
to load `http://localhost:1420` and shows "connection refused".

Checks, as CI runs them: `npx tsc --noEmit`, `npm test`, `npm run lint`,
`npm run format-check`, and `cargo test` in `src-tauri/`.

### Windows (cross-compiled from Linux)

Uses the MinGW toolchain (`x86_64-w64-mingw32-gcc` + the
`x86_64-pc-windows-gnu` Rust target; linker configured in
`src-tauri/.cargo/config.toml`):

```sh
cargo tauri build --target x86_64-pc-windows-gnu --no-bundle
# binary: src-tauri/target/x86_64-pc-windows-gnu/release/ef-launcher.exe
```

The resulting `ef-launcher.exe` needs `WebView2Loader.dll` beside it (copied
from the `webview2-com-sys` crate's `x64/` folder). Windows 10/11 ship the
WebView2 runtime, so nothing else is required.

CI (`.github/workflows/build.yml`) builds native installers for both platforms
on `workflow_dispatch` and version tags.

### Packaging (from Linux)

Release version comes from `src-tauri/Cargo.toml` + `tauri.conf.json` +
`package.json` (`scripts/release.sh` bumps all three; keep them identical); a release means uploading the matching binary AND setting the
same number in the CDN `config.ini`.

**MSI** (needs `msitools`): bundles the exe + `WebView2Loader.dll`, installs
per-user to `%LocalAppData%\Programs\Elemental Fracture` (no elevation, so
self-update can swap the binary), Start Menu shortcut included.

```sh
wixl -a x64 -D Version=1.0.0 \
  -D ExeSource=path/to/ef-launcher.exe \
  -D DllSource=dist/windows/WebView2Loader.dll \
  -o ElementalFractureInstall.msi packaging/ElementalFractureInstall.wxs
```

**AppImage** (needs `cargo-tauri`; bundles webkit/gtk via linuxdeploy):

```sh
cd src-tauri
APPIMAGE_EXTRACT_AND_RUN=1 NO_STRIP=true cargo tauri build --bundles appimage
# output: src-tauri/target/release/bundle/appimage/Elemental Fracture_<ver>_amd64.AppImage
```

Self-update on Linux replaces the `.AppImage` file itself (`$APPIMAGE`),
pulling `{cdn}/launcher/ef-launcher.AppImage`; plain binaries and Windows
pull `ef-launcher`/`ef-launcher.exe` and swap in place.

The AppImage inherits the **glibc of the box that built it** (linuxdeploy
bundles gtk/webkit, not libc). Build it on Ubuntu 22.04 (glibc 2.35, the
`Humble-ROS2` toolbox); `scripts/release.sh` refuses a host or a bundle above
that floor, because a build from a newer distro fails on every LTS and the
Steam Deck with `GLIBC_2.4x not found`.

### Release integrity

Every payload the launcher downloads (base game, balance patch, playtest pak,
`mod.zip`, the launcher binaries, the umu runtime tarball) has to hash to an
entry in `{cdn}/launcher/manifest.json`, and that manifest has to carry a valid
ed25519 signature (`manifest.json.sig`) from a key compiled into the launcher
(`RELEASE_KEYS` in `download/manifest.rs`). No entry, no signature, or a bad
hash: the install is refused and nothing on disk is touched. The manifest's
`version` is monotonic (publish time in seconds) and each install remembers the
highest it has accepted, so a rolled-back CDN can't roll an install back.

What that means for publishing: **every payload change on the CDN needs a
re-sign**, or every launcher out there fails to update until it gets one.

```sh
scripts/sign-manifest.sh --upload        # hash the live objects, sign, publish
```

`release.sh --upload` runs it for you. Publishing a new `mod.zip` or
`latest.zip` by hand (or with Marla's `/cdn upload`) does not; run it after.
The private key lives with the release tooling (`~/.config/ef-release/`),
never on the CDN or in a repo; hashes are cached per object ETag so a re-sign
after a small payload change doesn't re-read the 10 GB base game.

Downloads are **resumable**: a `.state` sidecar beside each in-flight payload
records the segment positions, and the next attempt continues from there if
the server still offers the same object (same ETag and size). A finished
payload whose extraction failed is reused rather than fetched again. Both rest
on the hash check above, which is what makes trusting partial bytes safe.

---

## Repo layout

```
ui/                     Frontend (HTML/CSS/JS + assets)
src-tauri/              Rust core, Tauri config, icons
  src/                    Command modules
  .cargo/config.toml      Windows cross-compile linker
.github/workflows/      CI build
```

## License

The launcher's source code is released under the [MIT License](LICENSE).
Attribution is the only condition: keep the copyright and permission notice
in any copy or derivative.

Some bundled files are not ours and are not covered by that license:

- **Spellbreak artwork** (`ui/assets/art/`, `ui/assets/launch-bg*.png`,
  `ui/assets/logo-full.png`, `ui/assets/mark.png`, `packaging/art/`) is the
  property of Proletariat, Inc. It is here so the launcher looks like the game
  it starts. Do not reuse it outside this project.
- **Friz Quadrata** (`ui/assets/fonts/FrizQuadrata-Regular.ttf`) is a
  commercial typeface used under its own terms. **Montserrat** is under the
  SIL Open Font License.
- **Brand icons** in `ui/assets/icons/` are from Font Awesome Free (CC BY 4.0).
- **WiX UI dialogs** in `packaging/wixui/ui/` are from the WiX Toolset under
  the Microsoft Reciprocal License (see `packaging/wixui/ui/LICENSE.txt`).
- **WebView2Loader.dll** is Microsoft's WebView2 redistributable.

The Elemental Fracture name, the servers and the account system are the
community's; the launcher talks to them but this license grants no access to
them.
