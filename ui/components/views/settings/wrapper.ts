/** Sentinel the wrapper Select uses for "Custom…" — no real command is empty. */
export const CUSTOM_WRAPPER = "__custom__";

export interface WrapperState {
  mode: "select" | "custom";
  value: string;
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
