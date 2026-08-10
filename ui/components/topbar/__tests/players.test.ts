import { describe, expect, it } from "vitest";
import {
  modeLabel,
  playersByMode,
  playersByRegion,
  playersByVariant,
  regionsOf,
  totalPlayers,
  variantTotal,
  variantOf,
} from "../players";

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
    expect(byMode.get("Solos")).toEqual({ count: 0, names: [] });
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
    expect(byMode.get("Squads")).toEqual({ count: 3, names: [] });
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

  it("pools servers of the same mode regardless of region", () => {
    const byMode = playersByMode([
      { display_name: "NA Duos", players: 4, region: "NA" },
      { display_name: "EU Duos", players: 6, region: "EU" },
      { display_name: "EU Duos #2", players: 2, region: "EU" },
    ]);
    expect(byMode.get("Duos")?.count).toBe(12);
  });
});

describe("regionsOf", () => {
  it("leads with NA, then EU", () => {
    expect(
      regionsOf([
        { display_name: "EU Solos", region: "EU" },
        { display_name: "NA Solos", region: "NA" },
      ])
    ).toEqual(["NA", "EU"]);
  });

  it("trails regions the order doesn't name, alphabetically", () => {
    expect(
      regionsOf([
        { display_name: "SA Solos", region: "SA" },
        { display_name: "OCE Solos", region: "OCE" },
        { display_name: "NA Solos", region: "NA" },
      ])
    ).toEqual(["NA", "OCE", "SA"]);
  });

  it("lists a region once however many servers sit in it", () => {
    expect(
      regionsOf([
        { display_name: "NA Solos", region: "NA" },
        { display_name: "NA Duos", region: "NA" },
      ])
    ).toEqual(["NA"]);
  });

  it("files a region-less server under Other", () => {
    expect(
      regionsOf([{ display_name: "NA Solos", region: "NA" }, { display_name: "Duos" }])
    ).toEqual(["NA", "Other"]);
  });

  it("falls back to the known regions when nothing is reported", () => {
    expect(regionsOf([])).toEqual(["NA", "EU"]);
  });
});

describe("variantTotal", () => {
  it("adds one balance's modes up", () => {
    const byVariant = playersByVariant([
      { display_name: "NA Solos", players: 5 },
      { display_name: "NA Duos", players: 2 },
      { name: "vsolo-1", display_name: "Classic Solos 1", players: 3 },
    ]);
    expect(variantTotal(byVariant.ef)).toBe(7);
    expect(variantTotal(byVariant.classic)).toBe(3);
  });

  it("is zero for a balance nobody is playing", () => {
    expect(variantTotal(playersByVariant([]).classic)).toBe(0);
  });
});

describe("totalPlayers", () => {
  it("adds both balances up into the region's figure", () => {
    const byVariant = playersByVariant([
      { display_name: "NA Solos", players: 5 },
      { display_name: "NA Duos", players: 2 },
      { name: "vsolo-1", display_name: "Classic Solos 1", players: 3 },
    ]);
    expect(totalPlayers(byVariant)).toBe(10);
  });

  it("is zero when nobody is in game", () => {
    expect(totalPlayers(playersByVariant([]))).toBe(0);
  });
});

describe("playersByRegion", () => {
  it("keys the breakdown by region, in tab order", () => {
    const byRegion = playersByRegion([
      { display_name: "EU Solos", players: 1, region: "EU" },
      { display_name: "NA Solos", players: 2, region: "NA" },
    ]);
    expect([...byRegion.keys()]).toEqual(["NA", "EU"]);
  });

  it("counts a mode only against the region its server sits in", () => {
    const byRegion = playersByRegion([
      { display_name: "NA Duos", players: 4, region: "NA" },
      { display_name: "EU Duos", players: 6, region: "EU" },
      { name: "vduos-1", display_name: "Classic Duos 1", players: 3, region: "NA" },
    ]);
    expect(byRegion.get("NA")?.ef.get("Duos")?.count).toBe(4);
    expect(byRegion.get("NA")?.classic.get("Duos")?.count).toBe(3);
    expect(byRegion.get("EU")?.ef.get("Duos")?.count).toBe(6);
    expect(byRegion.get("EU")?.classic.get("Duos")?.count).toBe(0);
  });

  it("keeps every mode row in every region section", () => {
    const byRegion = playersByRegion([{ display_name: "NA Solos", players: 1, region: "NA" }]);
    expect([...byRegion.get("NA")!.classic.keys()]).toEqual([
      "Solos",
      "Duos",
      "Squads",
      "Arena/TDM",
    ]);
  });
});

describe("variantOf", () => {
  it("reads the manager's vanilla container names as Classic", () => {
    expect(variantOf({ name: "vsolo-1" })).toBe("classic");
    expect(variantOf({ name: "vduos-2" })).toBe("classic");
    expect(variantOf({ name: "vsquad-1" })).toBe("classic");
    expect(variantOf({ name: "varena-3" })).toBe("classic");
  });

  it("reads a Classic display name as Classic", () => {
    expect(variantOf({ display_name: "Classic Solos 1" })).toBe("classic");
  });

  it("treats everything else as Elemental Fracture", () => {
    expect(variantOf({ name: "solo-1", display_name: "NA Solos #1" })).toBe("ef");
    expect(variantOf({})).toBe("ef");
  });

  it("does not mistake an EF server whose name merely starts with v", () => {
    expect(variantOf({ name: "vault-arena", display_name: "Vault Arena" })).toBe("ef");
  });
});

describe("playersByVariant", () => {
  it("keeps both sections listing every mode, populated or not", () => {
    const split = playersByVariant([]);
    expect([...split.ef.keys()]).toEqual(["Solos", "Duos", "Squads", "Arena/TDM"]);
    expect([...split.classic.keys()]).toEqual(["Solos", "Duos", "Squads", "Arena/TDM"]);
  });

  it("counts a mode against the balance its server runs", () => {
    const split = playersByVariant([
      { display_name: "NA Solos", players: 5 },
      { name: "vsolo-1", display_name: "Classic Solos 1", players: 2 },
    ]);
    expect(split.ef.get("Solos")?.count).toBe(5);
    expect(split.classic.get("Solos")?.count).toBe(2);
  });

  it("keeps the rosters apart", () => {
    const split = playersByVariant([
      { display_name: "NA Duos", players: 1, names: ["Lytion"] },
      { name: "vduos-1", display_name: "Classic Duos 1", players: 1, names: ["Doobs"] },
    ]);
    expect(split.ef.get("Duos")?.names).toEqual(["Lytion"]);
    expect(split.classic.get("Duos")?.names).toEqual(["Doobs"]);
  });
});
