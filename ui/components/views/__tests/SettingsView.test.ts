import { describe, expect, it } from "vitest";
import { computeWrapperState } from "../SettingsView";

const wrappers = [{ command: "umu-run" }, { command: "proton" }];

describe("computeWrapperState", () => {
  it("selects a saved command that the detector also found", () => {
    expect(computeWrapperState("umu-run", wrappers)).toEqual({
      mode: "select",
      value: "umu-run",
    });
  });

  it("ignores surrounding whitespace when matching", () => {
    expect(computeWrapperState("  proton  ", wrappers)).toEqual({
      mode: "select",
      value: "proton",
    });
  });

  it("suggests the first detected wrapper when nothing is saved yet", () => {
    expect(computeWrapperState("", wrappers)).toEqual({
      mode: "select",
      value: "umu-run",
    });
  });

  it("keeps a saved command the detector doesn't know as custom", () => {
    // Losing this would silently swap the user's launcher for a detected one
    // the next time Settings saves.
    expect(computeWrapperState("steam steam://rungameid/1815016993", wrappers)).toEqual({
      mode: "custom",
      value: "steam steam://rungameid/1815016993",
    });
  });

  it("falls back to custom when nothing was detected at all", () => {
    expect(computeWrapperState("", [])).toEqual({ mode: "custom", value: "" });
    expect(computeWrapperState("umu-run", [])).toEqual({ mode: "custom", value: "umu-run" });
  });
});
