import { describe, expect, it } from "vitest";
import {
  modeLabel,
  modeRows,
  modeRowsByVariant,
  regionsOf,
  rosterOf,
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

describe("modeRows", () => {
  const REGIONS = ["NA", "EU"];

  it("gives a mode one row, with a count per region column", () => {
    expect(
      modeRows(
        [
          { display_name: "NA Duos", players: 4, region: "NA" },
          { display_name: "EU Duos", players: 6, region: "EU" },
        ],
        REGIONS
      )
    ).toEqual([{ label: "Duos", counts: [4, 6] }]);
  });

  it("sums the servers of one mode within a region", () => {
    expect(
      modeRows(
        [
          { display_name: "EU Duos", players: 6, region: "EU" },
          { display_name: "EU Duos #2", players: 2, region: "EU" },
        ],
        REGIONS
      )
    ).toEqual([{ label: "Duos", counts: [0, 8] }]);
  });

  it("drops the modes nobody is in", () => {
    const rows = modeRows(
      [
        { display_name: "NA Solos", players: 5, region: "NA" },
        { display_name: "NA Duos", players: 0, region: "NA" },
      ],
      REGIONS
    );
    expect(rows.map((row) => row.label)).toEqual(["Solos"]);
  });

  it("is empty when nobody is in game", () => {
    expect(modeRows([], REGIONS)).toEqual([]);
  });

  it("orders the known modes, then the ones the matchers don't know", () => {
    const rows = modeRows(
      [
        { display_name: "Practice Range", players: 1, region: "NA" },
        { display_name: "NA Squads", players: 2, region: "NA" },
        { display_name: "NA Solos", players: 3, region: "NA" },
      ],
      REGIONS
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Solos",
      "Squads",
      "Practice Range",
    ]);
  });

  it("merges servers that map to the same bucket from different names", () => {
    expect(
      modeRows(
        [
          { display_name: "Arena", players: 2, region: "NA" },
          { display_name: "TDM 5v5", players: 3, region: "NA" },
        ],
        REGIONS
      )
    ).toEqual([{ label: "Arena/TDM", counts: [5, 0] }]);
  });

  it("treats a missing player count as zero rather than NaN", () => {
    expect(
      modeRows(
        [
          { display_name: "NA Solos", region: "NA" },
          { display_name: "EU Solos", players: 1, region: "EU" },
        ],
        REGIONS
      )
    ).toEqual([{ label: "Solos", counts: [0, 1] }]);
  });

  it("files a region-less server under the Other column", () => {
    expect(
      modeRows([{ display_name: "Solos", players: 2 }], ["NA", "Other"])
    ).toEqual([{ label: "Solos", counts: [0, 2] }]);
  });

  it("leaves out a server whose region has no column", () => {
    expect(
      modeRows([{ display_name: "SA Solos", players: 2, region: "SA" }], ["NA"])
    ).toEqual([]);
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
      regionsOf([
        { display_name: "NA Solos", region: "NA" },
        { display_name: "Duos" },
      ])
    ).toEqual(["NA", "Other"]);
  });

  it("falls back to the known regions when nothing is reported", () => {
    expect(regionsOf([])).toEqual(["NA", "EU"]);
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
    expect(variantOf({ name: "solo-1", display_name: "NA Solos #1" })).toBe(
      "ef"
    );
    expect(variantOf({})).toBe("ef");
  });

  it("does not mistake an EF server whose name merely starts with v", () => {
    expect(
      variantOf({ name: "vault-arena", display_name: "Vault Arena" })
    ).toBe("ef");
  });
});

describe("modeRowsByVariant", () => {
  it("counts a mode against the balance its server runs", () => {
    const split = modeRowsByVariant(
      [
        { display_name: "NA Solos", players: 5, region: "NA" },
        {
          name: "vsolo-1",
          display_name: "Classic Solos 1",
          players: 2,
          region: "NA",
        },
      ],
      ["NA"]
    );
    expect(split.ef).toEqual([{ label: "Solos", counts: [5] }]);
    expect(split.classic).toEqual([{ label: "Solos", counts: [2] }]);
  });

  it("gives a balance nobody is playing no rows to table", () => {
    const split = modeRowsByVariant(
      [{ display_name: "NA Solos", players: 5, region: "NA" }],
      ["NA"]
    );
    expect(split.classic).toEqual([]);
  });
});
