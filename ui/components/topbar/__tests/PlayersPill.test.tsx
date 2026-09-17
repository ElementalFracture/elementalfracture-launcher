import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlayersPill } from "../PlayersPill";
import type { PlayersData } from "@/lib/rust";

const live = vi.hoisted(() => ({
  playersData: null as PlayersData | null,
  refreshPlayers: vi.fn(),
}));

vi.mock("@/context/LiveDataContext", () => ({ useLiveData: () => live }));

/* Two regions, every family, a Classic lobby, and a mode nobody is in. */
const SERVERS = [
  {
    name: "solo-1",
    mode: "Solo",
    family: "Battle Royale",
    flavor: "Elemental Fracture",
    players: 5,
    region: "NA",
    state: "Started",
  },
  {
    name: "duos-1",
    mode: "Duo",
    family: "Battle Royale",
    flavor: "Elemental Fracture",
    players: 0,
    region: "NA",
    state: "WaitingForPlayers",
  },
  {
    name: "vsolo-1",
    mode: "Solo",
    family: "Battle Royale",
    flavor: "Classic",
    players: 2,
    region: "NA",
  },
  {
    name: "solo-1",
    mode: "Solo",
    family: "Battle Royale",
    flavor: "Elemental Fracture",
    players: 3,
    region: "EU",
  },
  {
    name: "arenas-1",
    mode: "Capture",
    family: "Dominion",
    flavor: "Elemental Fracture",
    players: 4,
    region: "EU",
  },
  {
    name: "custom-1",
    mode: "Custom Match",
    family: "Dominion",
    flavor: "Elemental Fracture",
    players: 2,
    region: "NA",
  },
  {
    name: "tclash-1",
    mode: "Team Clash",
    family: "Clash",
    flavor: "Test Build",
    players: 1,
    region: "NA",
  },
];

const open = () => {
  render(<PlayersPill />);
  fireEvent.click(screen.getByTitle("Players online: click for a breakdown"));
};

const tables = () => [...document.querySelectorAll("table.family-table")];

/** A family's table, found by the head of its mode column. */
const table = (family: string) =>
  tables().find((t) => t.querySelector("thead th")?.textContent === family)!;

const columns = (family: string) =>
  [...table(family).querySelectorAll("thead th")].map((th) => th.textContent);

/** Its rows, as [mode (+ build tag), ...one count per region column]. */
const rows = (family: string) =>
  [...table(family).querySelectorAll("tbody tr")].map((tr) =>
    [...tr.children].map((cell) => cell.textContent)
  );

beforeEach(() => {
  vi.clearAllMocks();
  live.playersData = { online: 17, total: 21, in_menu: 4, servers: SERVERS };
});

describe("PlayersPill", () => {
  it("counts everyone online, not just who is in a match", () => {
    render(<PlayersPill />);
    expect(screen.getByTitle(/Players online/).textContent).toContain(
      "21 players online"
    );
  });

  it("falls back to the presence count on an older sidecar", () => {
    live.playersData = { online: 3, connected: 8, servers: [] };
    render(<PlayersPill />);
    expect(screen.getByTitle(/Players online/).textContent).toContain(
      "8 players online"
    );
  });

  it("splits the total into in a match and in the menus", () => {
    open();
    const summary = document.querySelector(".players-summary")!;
    expect(
      [...summary.querySelectorAll("div")].map((d) => d.textContent)
    ).toEqual(["In a match17", "In the menus4"]);
  });

  it("groups the modes by family, in order", () => {
    open();
    expect(
      tables().map((t) => t.querySelector("thead th")?.textContent)
    ).toEqual(["Battle Royale", "Dominion", "Clash"]);
    expect(columns("Battle Royale")).toEqual(["Battle Royale", "NA", "EU"]);
  });

  it("gives each mode and build a row, counted per region", () => {
    open();
    expect(rows("Battle Royale")).toEqual([
      ["Solo", "5", "3"],
      ["SoloClassic", "2", "0"],
      ["Duo", "0", "0"],
    ]);
    expect(rows("Dominion")).toEqual([
      ["Dominion", "0", "4"],
      ["Custom Match", "2", "0"],
    ]);
    expect(rows("Clash")).toEqual([["Team ClashTest Build", "1", "0"]]);
  });

  it("marks a mode whose match has started", () => {
    open();
    const [solo, , duo] = table("Battle Royale").querySelectorAll(".mode-dot");
    expect(solo.classList.contains("live")).toBe(true);
    expect(duo.classList.contains("live")).toBe(false);
  });

  it("keeps a mode this build doesn't know", () => {
    live.playersData = {
      online: 6,
      servers: [
        {
          name: "koth-1",
          mode: "King of the Hill",
          family: "Clash",
          players: 6,
          region: "NA",
        },
      ],
    };
    open();
    expect(rows("Clash")).toEqual([["King of the Hill", "6"]]);
  });

  it("says so when no server is reporting", () => {
    live.playersData = { online: 0, total: 0, servers: [] };
    open();
    expect(screen.getByText("No servers are reporting in.")).toBeTruthy();
  });

  it("refreshes the figures when the breakdown is opened", () => {
    open();
    expect(live.refreshPlayers).toHaveBeenCalled();
  });
});
