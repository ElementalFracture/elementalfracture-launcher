import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InGamePill } from "../InGamePill";
import type { PlayersData } from "@/lib/rust";

const live = vi.hoisted(() => ({
  playersData: null as PlayersData | null,
  refreshPlayers: vi.fn(),
}));
const game = vi.hoisted(() => ({ variant: "ef" as string }));

vi.mock("@/context/LiveDataContext", () => ({ useLiveData: () => live }));
vi.mock("@/context/GameContext", () => ({
  useGame: () => ({ status: { variant: game.variant } }),
}));

/* Two regions, both balances, and one mode nobody is in — enough shape to
   read every part of the breakdown off one render. */
const SERVERS = [
  {
    display_name: "NA Solos",
    players: 5,
    region: "NA",
    // Out of order, and "ash" is on the mode's two servers at once.
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
];

const open = () => {
  render(<InGamePill />);
  fireEvent.click(screen.getByTitle("Players in game: click for a breakdown"));
};

/** The row a mode label sits in, inside whichever section is open. */
const modeRow = (label: string) =>
  screen.getByText(label).closest(".mode-row") as HTMLElement;

const modeCount = (label: string) =>
  modeRow(label).querySelector(".game-mode-count")?.textContent;

/** A balance section's head, which carries its name and head count. */
const section = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}`) });

/** Whether a balance section is open, read off its accordion trigger. */
const expanded = (label: string) =>
  section(label).getAttribute("aria-expanded");

/** Each tab as [region, head count]. */
const tabs = () =>
  screen
    .getAllByRole("tab")
    .map((t) => [
      t.firstChild?.textContent,
      t.querySelector(".tab-count")?.textContent,
    ]);

beforeEach(() => {
  vi.clearAllMocks();
  live.playersData = { online: 10, servers: SERVERS };
  game.variant = "ef";
});

describe("InGamePill", () => {
  it("gives every reported region a tab, NA first", () => {
    open();
    expect(tabs().map(([region]) => region)).toEqual(["NA", "EU"]);
  });

  it("counts both balances into the region's tab figure", () => {
    open();
    // NA: 5 EF solos + 2 Classic solos, and nobody in duos.
    expect(tabs()).toEqual([
      ["NA", "(7)"],
      ["EU", "(3)"],
    ]);
  });

  it("opens the balance the install runs, and leaves the other shut", () => {
    game.variant = "classic";
    open();
    expect(expanded("Classic")).toBe("true");
    expect(expanded("Elemental Fracture")).toBe("false");
  });

  it("falls back to Elemental Fracture when the balance is unknown", () => {
    game.variant = "unknown";
    open();
    expect(expanded("Elemental Fracture")).toBe("true");
  });

  it("counts only the servers in the selected region", () => {
    open();
    expect(modeCount("Solos")).toBe("5");

    // The tab is named "EU 3" now that the head count rides along with it.
    fireEvent.click(screen.getByRole("tab", { name: /^EU/ }));
    expect(modeCount("Solos")).toBe("3");
  });

  it("heads each balance section with its own count", () => {
    open();
    // NA runs 5 EF solos against 2 Classic ones, and empty duos either side.
    expect(section("Elemental Fracture").textContent).toContain("(5)");
    expect(section("Classic").textContent).toContain("(2)");
  });

  it("mutes a mode nobody is in", () => {
    open();
    expect(modeRow("Duos").classList.contains("idle")).toBe(true);
    expect(modeRow("Solos").classList.contains("idle")).toBe(false);
  });

  it("refreshes the figures when the breakdown is opened", () => {
    open();
    expect(live.refreshPlayers).toHaveBeenCalled();
  });
});
