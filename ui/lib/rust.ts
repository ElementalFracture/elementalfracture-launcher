/**
 * The one place the frontend talks to Rust.
 *
 * Import it as a namespace so every crossing is visible at the call site:
 *
 *     import * as rust from "@/lib/rust";
 *     const status = await rust.getStatus();
 *
 * `rg '\brust\.'` is then a complete inventory of what the UI asks the
 * backend for. An eslint rule keeps `@/generated/bindings` and
 * `@tauri-apps/api` from being imported anywhere else.
 *
 * Error convention: every function here either returns its value or throws.
 * Commands the backend declares fallible come back as `Result` and are
 * unwrapped here, so no caller ever branches on `status === "ok"` — they
 * use try/catch, the same as for the infallible ones.
 *
 * What they throw is a `BackendError`, which carries the backend's error
 * *code* rather than a rendered sentence — the prose is picked in whatever
 * language is on screen. Catch blocks render it with `errorText()`, or more
 * often hand it straight to `toastError()`.
 */
import { commands } from "@/generated/bindings";
import { BackendError } from "@/i18n/errors";
import type {
  Account,
  AppError,
  FileCheck,
  GameStatus,
  LauncherUpdateInfo,
  NewsItem,
  ProtonOption,
  Result,
  Settings,
  LoginResult,
  SteamStatus,
  VersionInfo,
  WrapperOption,
} from "@/generated/bindings";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type {
  Account,
  AppError,
  FileCheck,
  GameStatus,
  LauncherUpdateInfo,
  NewsItem,
  ProtonOption,
  Settings,
  LoginResult,
  VersionInfo,
  WrapperOption,
};

/** Collapse a backend `Result` to its value, turning the error case into a throw. */
export function unwrap<T>(r: Result<T, AppError>): T {
  if (r.status === "ok") {
    return r.data;
  }
  throw new BackendError(r.error);
}

/* ---------------- settings ---------------- */

export async function getSettings(): Promise<Settings> {
  return await commands.getSettings();
}

export async function saveSettings(settings: Settings): Promise<void> {
  unwrap(await commands.saveSettings(settings));
}

export async function resetSettings(): Promise<Settings> {
  return unwrap(await commands.resetSettings());
}

/** Email/password sign-in (the account the website uses). Throws on auth failure. */
export async function loginEmail(email: string, password: string): Promise<LoginResult> {
  return unwrap(await commands.loginEmail(email, password));
}

/** Sign out: clears the stored session, name, avatar and roles. */
export async function logout(): Promise<void> {
  unwrap(await commands.logout());
}

/** Re-check the stored session's roles. `null` = nothing to report, roles kept. */
export async function refreshAccount(): Promise<Account | null> {
  return unwrap(await commands.refreshAccount());
}

/* ---------------- install / game state ---------------- */

export async function getStatus(): Promise<GameStatus> {
  return await commands.getStatus();
}

export async function getVersions(): Promise<VersionInfo> {
  return await commands.getVersions();
}

export async function getLauncherUpdate(): Promise<LauncherUpdateInfo> {
  return await commands.getLauncherUpdate();
}

export async function verifyInstall(): Promise<FileCheck[]> {
  return await commands.verifyInstall();
}

export async function detectWrappers(): Promise<WrapperOption[]> {
  return await commands.detectWrappers();
}

export async function detectProtons(): Promise<ProtonOption[]> {
  return await commands.detectProtons();
}

export async function getRemoteConfig(): Promise<Partial<Record<string, string>>> {
  return await commands.getRemoteConfig();
}

/* ---------------- actions ---------------- */

export async function pickGameDir(title: string | null): Promise<string | null> {
  return await commands.pickGameDir(title);
}

export async function autoFindGame(): Promise<string | null> {
  return await commands.autoFindGame();
}

/**
 * Make sure a game runtime exists (umu-run/Proton, or Wine). Provisions umu-run
 * on a bare Linux box; a no-op when a runtime is already installed. Returns a
 * short status string. Called before launch so a fresh install can actually run.
 */
export async function ensureRuntime(): Promise<string> {
  return unwrap(await commands.ensureRuntime());
}

export async function launchGame(): Promise<void> {
  // Self-heal the runtime first: on a machine with no umu/Proton/Wine this sets
  // one up (with progress), and skips instantly when one is already present.
  await ensureRuntime();
  unwrap(await commands.launchGame());
}

export async function setVariant(variant: string): Promise<string> {
  return unwrap(await commands.setVariant(variant));
}

/** Pull the playtest pak and switch onto it. Returns the variant now active. */
export async function installPlaytestBuild(): Promise<string> {
  return unwrap(await commands.installPlaytestBuild());
}

export async function downloadGame(dest: string): Promise<string> {
  return unwrap(await commands.downloadGame(dest));
}

export async function updatePatch(): Promise<string> {
  return unwrap(await commands.updatePatch());
}

export async function installMods(): Promise<string[]> {
  return unwrap(await commands.installMods());
}

export async function updateLauncher(): Promise<void> {
  unwrap(await commands.updateLauncher());
}

export async function openUrl(url: string): Promise<void> {
  unwrap(await commands.openUrl(url));
}

/* ---------------- Steam ---------------- */

export async function steamStatus(): Promise<SteamStatus> {
  return await commands.steamStatus();
}

/** Point Spellbreak's Play button in Steam at the launcher, or put it back. */
export async function steamSetLinked(linked: boolean): Promise<SteamStatus> {
  return unwrap(await commands.steamSetLinked(linked));
}

/** Add the shortcut to Steam as a non-Steam game, or remove it: the
    launcher on Windows, the game set up as the Linux guide does on Linux. */
export async function steamSetShortcut(added: boolean): Promise<SteamStatus> {
  return unwrap(await commands.steamSetShortcut(added));
}

/** Throws the reason quickstart opened the launcher instead of the game, if
    it did; resolves when there's nothing to tell. Only answers once. */
export async function takeQuickstartNotice(): Promise<void> {
  unwrap(await commands.takeQuickstartNotice());
}

/** Steam's game id for the game's shortcut, for the launch wrapper's Steam
    option; null when it has none. */
export async function steamGameId(): Promise<string | null> {
  return await commands.steamGameId();
}

/** The Proton build Steam forces on the game behind a game id, by Steam's
    name; null for Steam's default. */
export async function steamCompatTool(gameId: string): Promise<string | null> {
  return await commands.steamCompatTool(gameId);
}

/** Force a Proton build on the game behind a game id, or with "" hand it
    back to Steam's default. Needs Steam closed. */
export async function steamSetCompatTool(
  gameId: string,
  tool: string
): Promise<void> {
  unwrap(await commands.steamSetCompatTool(gameId, tool));
}

/** The Proton builds Steam can force on the game shortcut. */
export async function steamCompatTools(): Promise<ProtonOption[]> {
  return await commands.steamCompatTools();
}

/** Ask Steam to exit, so its settings can be changed. */
export async function steamShutdown(): Promise<void> {
  unwrap(await commands.steamShutdown());
}

/** Fully exit the launcher — the real quit path, bypassing minimize-on-close. */
export async function quitLauncher(): Promise<void> {
  await commands.quitLauncher();
}

/* ---------------- live data ---------------- */

/** One game server as the players sidecar reports it. */
export interface PlayerServer {
  display_name?: string;
  name?: string;
  players?: number;
  names?: string[];
  region?: string;
  /** Match state off the broadcast feed ("WaitingForPlayers" = lobby). */
  state?: string;
  /** "Solo", "Capture", "Team Clash", ... (players_sidecar.py server_kind). */
  mode?: string;
  /** "Battle Royale" | "Dominion" | "Clash". */
  family?: string;
  /** "Elemental Fracture" | "Classic" | "Test Build". */
  flavor?: string;
}

/** Sidecar player-count payload. */
export interface PlayersData {
  /** Players on a game server (lobby or match). */
  online?: number;
  /** Everyone with the game open, menus included (router presence). */
  total?: number;
  /** `total` minus `online`. */
  in_menu?: number;
  /** Router presence alone; what `total` falls back to on older sidecars. */
  connected?: number | null;
  servers?: PlayerServer[];
}

/** A community event from the sidecar's events feed. */
export interface EventItem {
  name?: string;
  start?: string;
  status?: string;
  description?: string;
  location?: string;
  interested?: number;
  url?: string;
}

export async function getPlayers(): Promise<PlayersData> {
  return unwrap(await commands.getPlayers()) as PlayersData;
}

/** The sidecar wraps its list in `{ events }`; unwrap that here so callers
 *  only ever see the list. Older sidecars omit it entirely. */
export async function getEvents(): Promise<EventItem[]> {
  const payload = unwrap(await commands.getEvents()) as { events?: EventItem[] } | null;
  return Array.isArray(payload?.events) ? payload.events : [];
}

export async function getNews(): Promise<NewsItem[]> {
  return unwrap(await commands.getNews());
}

/* ---------------- friends ---------------- */

/** Presence the sidecar reports for a player. */
export type FriendStatus = "online" | "in_game" | "offline";

/** One player in the friend graph. Pending requests carry no status. */
export interface Friend {
  username: string;
  status?: FriendStatus;
}

/** The friend graph as `/friends` returns it, from the caller's point of view. */
export interface FriendsData {
  ok?: boolean;
  error?: string;
  me?: { username?: string; status?: FriendStatus };
  friends?: Friend[];
  /** Requests waiting on the caller to accept. */
  incoming?: Friend[];
  /** Requests the caller has sent and nobody has answered yet. */
  outgoing?: Friend[];
}

/** What add/accept/remove come back with. `state` is only set by add. */
export interface FriendActionResult {
  ok?: boolean;
  error?: string;
  state?: "accepted" | "exists" | "sent";
  username?: string;
}

/** Friend list + statuses. Doubles as the presence heartbeat: asking marks
 *  the account online for as long as the launcher keeps polling. */
export async function friendsList(): Promise<FriendsData> {
  return unwrap(await commands.friendsList()) as FriendsData;
}

export async function friendAdd(username: string): Promise<FriendActionResult> {
  return unwrap(await commands.friendAdd(username)) as FriendActionResult;
}

export async function friendAccept(username: string): Promise<FriendActionResult> {
  return unwrap(await commands.friendAccept(username)) as FriendActionResult;
}

/** Unfriend, decline an incoming request, or cancel an outgoing one. */
export async function friendRemove(username: string): Promise<FriendActionResult> {
  return unwrap(await commands.friendRemove(username)) as FriendActionResult;
}

/* ---------------- events pushed from Rust ---------------- */

export interface InstallProgress {
  stage: string;
  message?: string;
  percent: number;
}

/** Subscribe to install/patch progress. Resolves to the unsubscribe handle. */
export function onInstallProgress(
  handler: (progress: InstallProgress) => void
): Promise<UnlistenFn> {
  return listen<InstallProgress>("install-progress", (ev) => handler(ev.payload));
}
