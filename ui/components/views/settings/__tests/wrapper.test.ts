import { describe, expect, it } from "vitest";
import { computeWrapperState, parseSteamGameId } from "../wrapper";

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
    expect(computeWrapperState("gamemoderun umu-run", wrappers)).toEqual({
      mode: "custom",
      value: "gamemoderun umu-run",
    });
  });

  it("reads a Steam launch back as the Steam option and its game id", () => {
    expect(
      computeWrapperState("steam steam://rungameid/18150169937639899136", wrappers)
    ).toEqual({ mode: "steam", value: "18150169937639899136" });
    // Anything more than the bare launch is the player's own command.
    expect(
      computeWrapperState("steam steam://rungameid/1 -silent", wrappers).mode
    ).toBe("custom");
  });

  it("falls back to custom when nothing was detected at all", () => {
    expect(computeWrapperState("", [])).toEqual({ mode: "custom", value: "" });
    expect(computeWrapperState("umu-run", [])).toEqual({ mode: "custom", value: "umu-run" });
  });
});

describe("parseSteamGameId", () => {
  /* What the guide has players copy: the whole Exec= line, or what follows. */
  it("takes the id out of whatever was pasted", () => {
    for (const pasted of [
      "18150169937639899136",
      " 18150169937639899136 ",
      "steam://rungameid/18150169937639899136",
      "steam steam://rungameid/18150169937639899136",
      "Exec=steam steam://rungameid/18150169937639899136",
    ]) {
      expect(parseSteamGameId(pasted)).toBe("18150169937639899136");
    }
  });

  it("refuses anything that isn't an id", () => {
    for (const typed of ["", "abc", "steam", "123 456", "steam://run/1"]) {
      expect(parseSteamGameId(typed)).toBeNull();
    }
  });
});
