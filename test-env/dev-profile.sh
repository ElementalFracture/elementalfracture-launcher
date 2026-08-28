#!/usr/bin/env bash
#
# dev-profile.sh — seed the dev profile, then run the launcher against it.
#
# Debug builds keep their settings in a `dev/` subdir of the app config dir
# (see `config_dir` in src-tauri/src/settings.rs), so `tauri dev` already
# leaves the profile you play with alone. This puts that dev profile into a
# state the app has no way back to on its own:
#
#     test-env/dev-profile.sh signed-out    # your real settings, minus the token
#     test-env/dev-profile.sh fresh         # empty: first-boot wizard
#     test-env/dev-profile.sh keep          # leave it as-is, just run
#
# `signed-out` copies your real settings.json with the four identity fields
# blanked, so game path and wrapper carry over and only the login differs — no
# re-onboarding to get to the Guest pill. The login, auth, players and CDN URLs
# are left out of the copy so they fall back to the debug defaults, which point
# at this test env; sign back in with one of its email/password pairs
# (README.md). The real profile is only ever read from. Log in inside the dev
# profile if you want; the next `signed-out` run blanks it again, which is what
# the name promises.
#
# Note what the CDN default means once the test env is up: an update installs
# fixture paks into whatever game_path came across in the copy. Point that at a
# copy of the install, or set CDN_BASE (below) back at the real CDN.
#
# Debug builds never check the CDN for a newer launcher, so a dev session can't
# end up stuck behind the blocking update modal; prefix with
# EF_LAUNCHER_UPDATE=1 to run that check anyway (test-env/README.md).
#
# Linux only: on Windows the config dir comes from %APPDATA%.
#
set -euo pipefail

PROFILE="${1:-signed-out}"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${XDG_CONFIG_HOME:-$HOME/.config}/com.elefrac.launcher"
DEV="$APP/dev"

case "$PROFILE" in
  signed-out)
    if [ ! -f "$APP/settings.json" ]; then
      echo "no settings at $APP/settings.json — nothing to derive from." >&2
      echo "run '$0 fresh' and onboard in the dev profile instead." >&2
      # (or point the account URLs at the test env and use its accounts — README.md)
      exit 1
    fi
    mkdir -p "$DEV"
    node -e '
      const fs = require("fs");
      const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      Object.assign(s, { auth_token: "", username: "", is_staff: false, is_dev: false });
      // Dropped rather than blanked: Settings is #[serde(default)], so a missing
      // key takes the debug default, which already aims at the test env. Written
      // out they would pin whatever your real profile happens to point at.
      //
      // login_url belongs on this list as much as the rest: Settings → Advanced
      // has no field for it, so a copy that kept it would send every sign-in to
      // production while auth and players talked to the test env.
      delete s.login_url;
      delete s.auth_url;
      delete s.players_url;
      delete s.cdn_base;
      fs.writeFileSync(process.argv[2], JSON.stringify(s, null, 2));
    ' "$APP/settings.json" "$DEV/settings.json"
    ;;

  fresh)
    # Guard the wipe: only ever remove the dev subdir, never the real profile.
    case "$DEV" in
      */com.elefrac.launcher/dev) rm -rf "$DEV" ;;
      *)
        echo "refusing to clear '$DEV' — not a dev profile path" >&2
        exit 1
        ;;
    esac
    mkdir -p "$DEV"
    ;;

  keep) ;;

  *)
    echo "unknown profile '$PROFILE' (want: signed-out, fresh, keep)" >&2
    exit 1
    ;;
esac

# Aim the dev profile's downloads somewhere other than the debug default (which
# is already this test env on 8787) — the real CDN, or a non-default PORT:
#
#     CDN_BASE=https://cdn.elefrac.com test-env/dev-profile.sh keep
#     CDN_BASE=http://localhost:9000 test-env/dev-profile.sh keep
#
# Written into the dev profile only, and it sticks like any Settings → Advanced
# edit until something changes it — including a later `signed-out` run, which
# drops the key again.
if [ -n "${CDN_BASE:-}" ]; then
  mkdir -p "$DEV"
  node -e '
    const fs = require("fs");
    const [file, base] = process.argv.slice(1);
    const s = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    s.cdn_base = base;
    fs.writeFileSync(file, JSON.stringify(s, null, 2));
  ' "$DEV/settings.json" "$CDN_BASE"
  echo "cdn_base:    $CDN_BASE"
fi

echo "dev profile: $DEV ($PROFILE)"
exec npm run --prefix "$REPO" tauri-dev
