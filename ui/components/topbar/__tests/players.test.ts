import { describe, expect, it } from "vitest";
import { breakdownOf, kindOf, regionsOf, rosterOf, totalsOf } from "../players";

describe("kindOf", () => {
  it("reads the mode, family and build the sidecar reports", () => {
    expect(
      kindOf({ name: "vclash-2", mode: "Team Clash", flavor: "Classic" })
    ).toEqual({
      family: "clash",
      mode: "clash",
      label: "clash",
      flavor: "classic",
    });
    expect(kindOf({ name: "arenas-1", mode: "Capture" }).mode).toBe("dominion");
    expect(kindOf({ name: "ffa-1", mode: "Free for all" }).family).toBe(
      "clash"
    );
    expect(kindOf({ name: "tdm-1", mode: "Team Deathmatch" }).family).toBe(
      "dominion"
    );
  });

  it("files Custom Match under Dominion", () => {
    expect(kindOf({ name: "custom-1", mode: "Custom Match" }).family).toBe(
      "dominion"
    );
  });

  it("falls back to the server name on a sidecar that sends no mode", () => {
    expect(kindOf({ name: "solo-1" })).toMatchObject({
      mode: "solo",
      flavor: "ef",
    });
    expect(kindOf({ name: "vsquads-3" })).toMatchObject({
      mode: "squad",
      flavor: "classic",
    });
    expect(kindOf({ name: "ttdm-1" })).toMatchObject({
      mode: "tdm",
      flavor: "test",
    });
    expect(kindOf({ name: "tdm-1" })).toMatchObject({
      mode: "tdm",
      flavor: "ef",
    });
    expect(kindOf({ name: "vcustom-1" })).toMatchObject({
      mode: "custom",
      flavor: "classic",
    });
  });

  it("maps the sidecar's Test Build flavor", () => {
    expect(kindOf({ name: "tsolo-1", flavor: "Test Build" }).flavor).toBe(
      "test"
    );
  });

  it("keeps a mode it doesn't know under the sidecar's name and family", () => {
    expect(
      kindOf({ name: "koth-1", mode: "King of the Hill", family: "Clash" })
    ).toEqual({ family: "clash", label: "King of the Hill", flavor: "ef" });
    expect(
      kindOf({ name: "range-1", display_name: "Practice Range 1" })
    ).toEqual({
      family: "other",
      label: "Practice Range",
      flavor: "ef",
    });
  });
});

describe("totalsOf", () => {
  it("is empty before the first answer", () => {
    expect(totalsOf(null)).toEqual({ total: null, inMatch: 0, inMenus: 0 });
  });

  it("reads total, online and in_menu as sent", () => {
    expect(totalsOf({ online: 5, total: 9, in_menu: 4 })).toEqual({
      total: 9,
      inMatch: 5,
      inMenus: 4,
    });
  });

  it("derives them from connected on an older sidecar", () => {
    expect(totalsOf({ online: 5, connected: 7 })).toEqual({
      total: 7,
      inMatch: 5,
      inMenus: 2,
    });
    // Presence stale: never fewer online than are on a server.
    expect(totalsOf({ online: 5, connected: null })).toEqual({
      total: 5,
      inMatch: 5,
      inMenus: 0,
    });
  });

  it("sums the servers when online is missing", () => {
    expect(
      totalsOf({ servers: [{ players: 2 }, { players: 3 }, {}] }).inMatch
    ).toBe(5);
  });
});

describe("breakdownOf", () => {
  const REGIONS = ["NA", "EU"];

  it("sums a mode per region and keeps an idle mode's row", () => {
    const sections = breakdownOf(
      [
        { name: "solo-1", mode: "Solo", region: "NA", players: 4 },
        { name: "solo-2", mode: "Solo", region: "NA", players: 1 },
        { name: "solo-1", mode: "Solo", region: "EU", players: 6 },
        { name: "duos-1", mode: "Duo", region: "EU", players: 0 },
      ],
      REGIONS
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].family).toBe("battleRoyale");
    expect(sections[0].rows.map((r) => [r.mode, r.counts])).toEqual([
      ["solo", [5, 6]],
      ["duo", [0, 0]],
    ]);
  });

  it("orders families and modes, then builds", () => {
    const sections = breakdownOf(
      [
        { name: "ffa-1", region: "NA", players: 1 },
        { name: "tclash-1", region: "NA", players: 1 },
        { name: "clash-1", region: "NA", players: 1 },
        { name: "custom-1", region: "NA", players: 1 },
        { name: "arenas-1", region: "NA", players: 1 },
        { name: "vsolo-1", region: "NA", players: 1 },
        { name: "squads-1", region: "NA", players: 1 },
      ],
      REGIONS
    );
    expect(
      sections.map((s) => [
        s.family,
        s.rows.map((r) => `${r.mode}/${r.flavor}`),
      ])
    ).toEqual([
      ["battleRoyale", ["solo/classic", "squad/ef"]],
      ["dominion", ["dominion/ef", "custom/ef"]],
      ["clash", ["clash/ef", "clash/test", "ffa/ef"]],
    ]);
  });

  it("marks a row live when any of its matches has started", () => {
    const [section] = breakdownOf(
      [
        { name: "solo-1", region: "NA", state: "WaitingForPlayers" },
        { name: "solo-2", region: "NA", state: "Started" },
      ],
      REGIONS
    );
    expect(section.rows[0].live).toBe(true);
  });

  it("treats a missing player count as zero", () => {
    const [section] = breakdownOf([{ name: "solo-1", region: "EU" }], REGIONS);
    expect(section.rows[0].counts).toEqual([0, 0]);
  });

  it("is empty with no servers", () => {
    expect(breakdownOf([], REGIONS)).toEqual([]);
  });
});

describe("regionsOf", () => {
  it("leads with NA, then EU, then the rest alphabetically", () => {
    expect(
      regionsOf([
        { region: "SA" },
        { region: "EU" },
        { region: "OCE" },
        { region: "NA" },
      ])
    ).toEqual(["NA", "EU", "OCE", "SA"]);
  });

  it("lists a region once, and a region-less server last", () => {
    expect(regionsOf([{}, { region: "NA" }, { region: "NA" }])).toEqual([
      "NA",
      "",
    ]);
  });
});

describe("rosterOf", () => {
  it("lists each player once, sorted by name", () => {
    expect(rosterOf(["cinder", "ash", "Briar", "ash"])).toEqual([
      "ash",
      "Briar",
      "cinder",
    ]);
  });

  it("is empty when the mode reports no names", () => {
    expect(rosterOf([])).toEqual([]);
  });

  it("leads with the friends, each side alphabetical", () => {
    const friends = new Set(["dusk", "ash"]);
    expect(
      rosterOf(["cinder", "ash", "briar", "dusk"], (p) => friends.has(p))
    ).toEqual(["ash", "dusk", "briar", "cinder"]);
  });
});
