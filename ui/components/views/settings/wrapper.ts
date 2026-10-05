/** Sentinel the wrapper Select uses for "Custom…" — no real command is empty. */
export const CUSTOM_WRAPPER = "__custom__";

/** Sentinel the Proton Select uses for "Automatic" — stored as "". */
export const AUTO_PROTON = "__auto__";

/** Whether a launch command runs through Proton, the same test the backend
 *  makes before it hands over PROTONPATH — so the Proton picker shows exactly
 *  when the pick is used. */
export function usesProton(command: string): boolean {
  return command.includes("umu") || command.includes("proton");
}

/** Sentinel the wrapper Select uses for "Steam": Play has Steam start the
 *  game's shortcut, by its game id. */
export const STEAM_WRAPPER = "__steam__";

/** `value` is the command for "select" and "custom", the game id for "steam". */
export interface WrapperState {
  mode: "select" | "custom" | "steam";
  value: string;
}

const STEAM_COMMAND = /^steam\s+steam:\/\/rungameid\/(\d+)$/;

/** The command the Steam option writes for a game id. */
export function steamCommand(id: string): string {
  return `steam steam://rungameid/${id}`;
}

/** The game id in what the player typed or pasted: the bare number, the
 *  `steam://rungameid/` URL, or the whole `Exec=` line of Steam's desktop
 *  shortcut. Null when there is none. */
export function parseSteamGameId(input: string): string | null {
  const m = input
    .trim()
    .match(/^(?:Exec=)?(?:(?:steam\s+)?steam:\/\/rungameid\/)?(\d+)$/);
  return m ? m[1] : null;
}

/**
 * Classify the saved launch command against the wrappers the backend detected:
 * a known command drives the picker, anything else is free text. A saved
 * command the detector doesn't know must stay custom, or the next save would
 * silently swap the user's launcher for a detected one.
 */
export function computeWrapperState(
  cur: string,
  wrappers: { command: string }[]
): WrapperState {
  const trimmed = cur.trim();
  const steam = trimmed.match(STEAM_COMMAND);
  if (steam) {
    return { mode: "steam", value: steam[1] };
  }
  if (trimmed && wrappers.some((w) => w.command === trimmed)) {
    return { mode: "select", value: trimmed };
  }
  if (!trimmed && wrappers.length) {
    return { mode: "select", value: wrappers[0].command };
  }
  return { mode: "custom", value: trimmed };
}

/**
 * Plain Wine: no Proton, so no DXVK, and the game renders through Wine's own
 * Direct3D (flat white characters, a fraction of the frame rate). Mirrors the
 * backend's `is_plain_wine`, which moves such a setting to umu-run before each
 * launch; here it only drives the warning. Anything naming umu or Proton, and
 * any unknown custom command, is not plain Wine.
 */
export function isPlainWine(command: string): boolean {
  const c = command.trim();
  const lower = c.toLowerCase();
  if (lower.includes("umu") || lower.includes("proton")) {
    return false;
  }
  if (c.includes("org.winehq.Wine")) {
    return true;
  }
  const first = c.split(/\s+/)[0] ?? "";
  const name = first.split("/").pop() ?? "";
  return [
    "wine",
    "wine64",
    "wine-stable",
    "wine-staging",
    "wine-development",
  ].includes(name);
}
