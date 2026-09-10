import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatEventTime, greeting, stageLabel } from "../format";
import { setLocale } from "@/i18n";

/* These read the catalogue, and the locale is module state — the shared setup
   resets it after every test, so each case only has to say what it wants. */
beforeEach(() => setLocale("en"));

describe("greeting", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const at = (hour: number) => {
    vi.setSystemTime(new Date(2026, 6, 27, hour, 0, 0));
    return greeting("Lytion", 0);
  };

  it("picks a line for the time of day", () => {
    expect(at(8)).toBe("Good morning, Lytion!");
    expect(at(14)).toBe("Good afternoon, Lytion!");
    expect(at(19)).toBe("Good evening, Lytion!");
    expect(at(23)).toBe("Burning the midnight oil, Lytion?");
  });

  it("treats the small hours as night, not morning", () => {
    // The night band wraps midnight (>=22 or <5), which is easy to get wrong.
    expect(at(2)).toBe("Burning the midnight oil, Lytion?");
    expect(at(5)).toBe("Good morning, Lytion!");
    expect(at(21)).toBe("Good evening, Lytion!");
    expect(at(22)).toBe("Burning the midnight oil, Lytion?");
  });

  it("wraps the pick index instead of running off the end", () => {
    vi.setSystemTime(new Date(2026, 6, 27, 14, 0, 0));
    expect(greeting("Lytion", 1)).toBe(
      "Perfect weather for a Spellstorm, Lytion."
    );
    expect(greeting("Lytion", 2)).toBe(greeting("Lytion", 0));
  });
});

describe("formatEventTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("calls an active event live regardless of its start", () => {
    expect(
      formatEventTime({ status: "ACTIVE", start: "2020-01-01T00:00:00Z" })
    ).toBe("LIVE NOW");
  });

  it("is empty when there is no start to format", () => {
    expect(formatEventTime({})).toBe("");
  });

  // The absolute part is locale-dependent, so only the relative suffix is
  // asserted here.
  it("counts down in minutes within the hour", () => {
    expect(formatEventTime({ start: "2026-07-27T12:30:00Z" })).toMatch(
      /\(in 30 min\)$/
    );
  });

  it("never rounds an imminent event down to zero minutes", () => {
    expect(formatEventTime({ start: "2026-07-27T12:00:10Z" })).toMatch(
      /\(in 1 min\)$/
    );
  });

  it("counts down in hours within the day", () => {
    expect(formatEventTime({ start: "2026-07-27T18:00:00Z" })).toMatch(
      /\(in 6 h\)$/
    );
  });

  it("drops the countdown beyond a day out, and for past events", () => {
    expect(formatEventTime({ start: "2026-07-30T12:00:00Z" })).not.toMatch(
      /\(in /
    );
    expect(formatEventTime({ start: "2026-07-26T12:00:00Z" })).not.toMatch(
      /\(in /
    );
  });
});

describe("stageLabel", () => {
  it("names the pipeline stages the backend emits", () => {
    expect(stageLabel("download-base")).toBe("Downloading game");
    expect(stageLabel("install-mods")).toBe("Installing mods");
    expect(stageLabel("done")).toBe("Done");
  });

  /* The wire names are kebab-case and the catalogue keys are camelCase, so the
     two are bridged by a map that is easy to leave a stage out of. */
  it("names them in the language on screen too", () => {
    setLocale("fr");
    expect(stageLabel("download-base")).toBe("Téléchargement du jeu");
    expect(stageLabel("install-mods")).toBe("Installation des mods");
    expect(stageLabel("done")).toBe("Terminé");
  });

  it("shows an unrecognised stage rather than nothing", () => {
    expect(stageLabel("verify-shaders")).toBe("verify-shaders");
    setLocale("fr");
    expect(stageLabel("verify-shaders")).toBe("verify-shaders");
  });
});

describe("translated formatting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("greets in the language on screen", () => {
    setLocale("fr");
    expect(greeting("Lytion", 0)).toBe("Bon après-midi, Lytion !");
  });

  it("counts down in it as well", () => {
    setLocale("fr");
    expect(formatEventTime({ start: "2026-07-27T12:30:00Z" })).toMatch(
      /\(dans 30 min\)$/
    );
    expect(formatEventTime({ status: "ACTIVE" })).toBe("EN DIRECT");
  });

  /* The date beside the countdown is Intl's, and it used to be handed
     `undefined` — the OS language, which on a French UI on an English machine
     reads "Mon, Jul 27" next to "dans 30 min". */
  it("writes the date in that language, not the operating system's", () => {
    setLocale("fr");
    const when = formatEventTime({ start: "2026-07-30T12:00:00Z" });
    expect(when).toMatch(/juil/);
    expect(when).not.toMatch(/Jul/);
  });
});
