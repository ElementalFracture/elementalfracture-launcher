import { describe, expect, it } from "vitest";
import { hasMultipleRegions, modeLabel, playersByMode, regionSplit } from "../TopBar";

describe("modeLabel", () => {
  it("buckets a server by the mode named in its display name", () => {
    expect(modeLabel({ display_name: "NA-East Solos #2" })).toBe("Solos");
    expect(modeLabel({ display_name: "EU Duos" })).toBe("Duos");
    expect(modeLabel({ display_name: "squad queue" })).toBe("Squads");
  });

  it("folds the arena-ish modes into one bucket", () => {
    expect(modeLabel({ display_name: "Arena" })).toBe("Arena/TDM");
    expect(modeLabel({ display_name: "TDM 5v5" })).toBe("Arena/TDM");
    expect(modeLabel({ display_name: "Capture the Flag" })).toBe("Arena/TDM");
  });

  it("falls back to name when there is no display name", () => {
    expect(modeLabel({ name: "EU Duos" })).toBe("Duos");
    expect(modeLabel({ name: "Practice Range" })).toBe("Practice Range");
  });

  it("labels an unnamed server rather than rendering a blank row", () => {
    expect(modeLabel({})).toBe("Other");
    expect(modeLabel({ display_name: "" })).toBe("Other");
  });
});

describe("playersByMode", () => {
  it("lists every known mode even when no server reports one", () => {
    const byMode = playersByMode([]);
    expect([...byMode.keys()]).toEqual(["Solos", "Duos", "Squads", "Arena/TDM"]);
    expect(byMode.get("Solos")).toEqual({
      count: 0,
      names: [],
      byRegion: new Map(),
    });
  });

  it("sums player counts across the servers in a mode", () => {
    const byMode = playersByMode([
      { display_name: "NA Duos", players: 4 },
      { display_name: "EU Duos", players: 6 },
    ]);
    expect(byMode.get("Duos")?.count).toBe(10);
  });

  it("pools the rosters of every server in a mode", () => {
    const byMode = playersByMode([
      { display_name: "NA Solos", players: 2, names: ["Lytion", "Doobs"] },
      { display_name: "EU Solos", players: 1, names: ["Breadman"] },
    ]);
    expect(byMode.get("Solos")?.names).toEqual(["Lytion", "Doobs", "Breadman"]);
  });

  it("counts players the sidecar declines to name", () => {
    const byMode = playersByMode([{ display_name: "Squads", players: 3 }]);
    expect(byMode.get("Squads")).toEqual({
      count: 3,
      names: [],
      byRegion: new Map(),
    });
  });

  it("treats a missing player count as zero rather than NaN", () => {
    const byMode = playersByMode([{ display_name: "Solos" }]);
    expect(byMode.get("Solos")?.count).toBe(0);
  });

  it("appends modes the matchers don't know, after the known ones", () => {
    const byMode = playersByMode([{ display_name: "Practice Range", players: 1 }]);
    expect([...byMode.keys()]).toEqual(["Solos", "Duos", "Squads", "Arena/TDM", "Practice Range"]);
    expect(byMode.get("Practice Range")?.count).toBe(1);
  });

  it("merges servers that map to the same bucket from different names", () => {
    const byMode = playersByMode([
      { display_name: "Arena", players: 2 },
      { display_name: "TDM 5v5", players: 3 },
    ]);
    expect(byMode.get("Arena/TDM")?.count).toBe(5);
  });

  it("splits a mode's total across the regions its servers sit in", () => {
    const byMode = playersByMode([
      { display_name: "NA Duos", players: 4, region: "NA" },
      { display_name: "EU Duos", players: 6, region: "EU" },
      { display_name: "EU Duos #2", players: 2, region: "EU" },
    ]);
    expect(byMode.get("Duos")?.byRegion).toEqual(
      new Map([
        ["NA", 4],
        ["EU", 8],
      ])
    );
  });

  it("leaves a region-less server out of the split but still in the total", () => {
    const byMode = playersByMode([
      { display_name: "Solos", players: 3, region: "NA" },
      { display_name: "Solos", players: 2 },
    ]);
    expect(byMode.get("Solos")?.count).toBe(5);
    expect(byMode.get("Solos")?.byRegion).toEqual(new Map([["NA", 3]]));
  });
});

describe("regionSplit", () => {
  const players = (byRegion: [string, number][]) => ({
    count: 0,
    names: [],
    byRegion: new Map(byRegion),
  });

  it("leads with NA, then EU", () => {
    expect(
      regionSplit(
        players([
          ["EU", 4],
          ["NA", 12],
        ])
      )
    ).toBe("NA 12 · EU 4");
  });

  it("trails regions the order doesn't name", () => {
    expect(
      regionSplit(
        players([
          ["OCE", 1],
          ["NA", 5],
        ])
      )
    ).toBe("NA 5 · OCE 1");
  });

  it("drops a region nobody is in", () => {
    expect(
      regionSplit(
        players([
          ["NA", 7],
          ["EU", 0],
        ])
      )
    ).toBe("NA 7");
  });

  it("is empty when no region reported", () => {
    expect(regionSplit(players([]))).toBe("");
  });
});

describe("hasMultipleRegions", () => {
  it("holds the split back while only one region reports", () => {
    expect(
      hasMultipleRegions([
        { display_name: "NA Solos", region: "NA" },
        { display_name: "NA Duos", region: "NA" },
      ])
    ).toBe(false);
  });

  it("turns the split on once a second region shows up", () => {
    expect(
      hasMultipleRegions([
        { display_name: "NA Solos", region: "NA" },
        { display_name: "EU Solos", region: "EU" },
      ])
    ).toBe(true);
  });

  it("ignores servers that report no region at all", () => {
    expect(hasMultipleRegions([{ display_name: "Solos" }, { display_name: "Duos" }])).toBe(false);
  });
});
