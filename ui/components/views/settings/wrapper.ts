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
