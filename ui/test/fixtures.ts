import type { GameStatus, Settings, VersionInfo } from "@/generated/bindings";

export function makeSettings(over: Partial<Settings> = {}): Settings {
  return {
    game_path: "/games/spellbreak",
    launch_command: "umu-run",
    wine_prefix: "",
    proton_path: "",
    play_base: "https://play.elefrac.com",
    cdn_base: "https://cdn.elefrac.com",
    auth_url: "https://play.elefrac.com/auth",
    players_url: "https://play.elefrac.com/players",
    username: "Lytion",
    is_staff: false,
    is_dev: false,
    is_tester: false,
    auth_token: "tok",
    spellbreak_id: "Lytion",
    avatar: "",
    discord_id: "",
    discord_avatar: "",
    login_url: "https://play.elefrac.com/login",
    onboarded: true,
    minimize_on_close: false,
    close_on_launch: false,
    run_as_admin: false,
    steam_autostart: false,
    language: "",
    manifest_version: 0,
    ...over,
  };
}

export function makeStatus(over: Partial<GameStatus> = {}): GameStatus {
  return {
    game_path: "/games/spellbreak",
    valid: true,
    exe_present: true,
    variant: "ef",
    test_installed: false,
    local_version: "6.0.2",
    ...over,
  };
}

export function makeVersions(over: Partial<VersionInfo> = {}): VersionInfo {
  const local = over.local !== undefined ? over.local : "6.0.2";
  const remote = over.remote !== undefined ? over.remote : "6.0.2";
  return {
    local,
    remote,
    local_game: over.local_game !== undefined ? over.local_game : local,
    remote_game: over.remote_game !== undefined ? over.remote_game : remote,
    local_mod:
      over.local_mod !== undefined ? over.local_mod : local ? "3.17.0" : null,
    remote_mod:
      over.remote_mod !== undefined
        ? over.remote_mod
        : remote
          ? "3.17.0"
          : null,
    ...over,
  };
}

/** A promise plus the handle to settle it, for ordering races deliberately. */
export function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
