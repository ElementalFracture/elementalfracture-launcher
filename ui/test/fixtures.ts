import type { GameStatus, Settings, VersionInfo } from "@/generated/bindings";

export function makeSettings(over: Partial<Settings> = {}): Settings {
  return {
    game_path: "/games/spellbreak",
    launch_command: "umu-run",
    wine_prefix: "",
    play_base: "https://play.elefrac.com",
    cdn_base: "https://cdn.elefrac.com",
    auth_url: "https://play.elefrac.com/auth",
    players_url: "https://play.elefrac.com/players",
    username: "Lytion",
    is_staff: false,
    is_dev: false,
    auth_token: "tok",
    onboarded: true,
    ...over,
  };
}

export function makeStatus(over: Partial<GameStatus> = {}): GameStatus {
  return {
    game_path: "/games/spellbreak",
    valid: true,
    exe_present: true,
    variant: "ef",
    local_version: "6.0.2",
    ...over,
  };
}

export function makeVersions(over: Partial<VersionInfo> = {}): VersionInfo {
  return { local: "6.0.2", remote: "6.0.2", ...over };
}

/** A promise plus the handle to settle it, for ordering races deliberately. */
export function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
