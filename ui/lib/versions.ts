import type { VersionInfo } from "@/lib/rust";

/* EF installs carry two version tracks: the GAME version is the balance pak,
   the MOD version is the DLL package. Each moves on its own release and the
   appserver gates on them separately, so an install is behind when EITHER one
   is, and the launcher has to bring both up before the game will let a player
   in. A CDN config from before the split carries only the one combined
   version, which is what the `remote`/`local` pair falls back to. */

/** True when either track is behind what the CDN serves. */
export function versionsBehind(v: VersionInfo | null | undefined): boolean {
  if (!v) {
    return false;
  }
  if (v.remote_game && v.local_game !== v.remote_game) {
    return true;
  }
  if (v.remote_mod && v.local_mod !== v.remote_mod) {
    return true;
  }
  if (!v.remote_game && !v.remote_mod) {
    return Boolean(v.remote && v.local !== v.remote);
  }
  return false;
}

/** True when the CDN answered at all, so "not behind" means current and not just unknown. */
export function versionsKnown(v: VersionInfo | null | undefined): boolean {
  return Boolean(v && (v.remote_game || v.remote_mod || v.remote));
}

/** The version an update plate names: whichever track is behind, game first. */
export function updateTarget(v: VersionInfo | null | undefined): string | null {
  if (!v) {
    return null;
  }
  if (v.remote_game && v.local_game !== v.remote_game) {
    return v.remote_game;
  }
  if (v.remote_mod && v.local_mod !== v.remote_mod) {
    return v.remote_mod;
  }
  return v.remote ?? null;
}
