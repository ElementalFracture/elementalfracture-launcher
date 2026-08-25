import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InGamePill } from "../InGamePill";
import type { PlayersData } from "@/lib/rust";

const live = vi.hoisted(() => ({
  playersData: null as PlayersData | null,
  refreshPlayers: vi.fn(),
}));

vi.mock("@/context/LiveDataContext", () => ({ useLiveData: () => live }));

/* Two regions, both balances, and one mode nobody is in — enough shape to
   read every part of the breakdown off one render. */
const SERVERS = [
  {
    display_name: "NA Solos",
    players: 5,
    region: "NA",
    names: ["cinder", "ash", "me", "briar", "ash"],
  },
  { display_name: "NA Duos", players: 0, region: "NA" },
  {
    name: "vsolo-1",
    display_name: "Classic Solos 1",
    players: 2,
    region: "NA",
  },
  { display_name: "EU Solos", players: 3, region: "EU", names: ["dusk"] },
  { display_name: "EU Squads", players: 4, region: "EU" },
];

const open = () => {
  render(<InGamePill />);
  fireEvent.click(screen.getByTitle("Players in game: click for a breakdown"));
};

/** A balance's table, found by the title above it. */
const table = (variant: string) =>
  screen
    .getByRole("heading", { name: variant })
    .closest("section")!
    .querySelector("table")!;

/** Its column heads, the mode one included — it reads as a screen-reader label. */
const columns = (variant: string) =>
  [...table(variant).querySelectorAll("thead th")].map((th) => th.textContent);

/** Its rows, as [mode, ...one count per region column]. */
const rows = (variant: string) =>
  [...table(variant).querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((cell) => cell.textContent)
  );

beforeEach(() => {
  vi.clearAllMocks();
  live.playersData = { online: 14, servers: SERVERS };
});

describe("InGamePill", () => {
  it("heads each balance with its name, no tab strip in the way", () => {
    open();
    expect(screen.queryAllByRole("tab")).toEqual([]);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Elemental Fracture",
      "Classic",
    ]);
  });

  it("gives every reported region a column, NA first", () => {
    open();
    expect(columns("Elemental Fracture")).toEqual(["Mode", "NA", "EU"]);
  });

  it("counts a mode against the region its server sits in", () => {
    open();
    expect(rows("Elemental Fracture")).toEqual([
      ["Solos", "5", "3"],
      ["Squads", "0", "4"],
    ]);
  });

  it("tables a balance's modes against its own servers only", () => {
    open();
    expect(rows("Classic")).toEqual([["Solos", "2", "0"]]);
  });

  it("leaves out a mode nobody is in", () => {
    open();
    // NA duos are reported but empty, so the mode gets no row at all.
    expect(screen.queryByText("Duos")).toBeNull();
  });

  it("mutes a region where nobody is in that mode", () => {
    open();
    // Squads run in EU only, so its NA cell is the muted one.
    const [, na, eu] = table("Elemental Fracture").querySelectorAll(
      "tbody tr:last-child > *"
    );
    expect(na.classList.contains("idle")).toBe(true);
    expect(eu.classList.contains("idle")).toBe(false);
  });

  it("drops a balance nobody is playing", () => {
    live.playersData = { online: 5, servers: [SERVERS[0]] };
    open();
    expect(screen.queryByRole("heading", { name: "Classic" })).toBeNull();
  });

  it("says so when nobody is in game at all", () => {
    live.playersData = { online: 0, servers: [] };
    open();
    expect(screen.getByText("No one in game")).toBeTruthy();
  });

  it("refreshes the figures when the breakdown is opened", () => {
    open();
    expect(live.refreshPlayers).toHaveBeenCalled();
  });
});
