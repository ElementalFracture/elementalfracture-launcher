import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InGamePill } from "../InGamePill";
import type { FriendsData, PlayersData } from "@/lib/rust";

const live = vi.hoisted(() => ({
  playersData: null as PlayersData | null,
  refreshPlayers: vi.fn(),
}));
const game = vi.hoisted(() => ({ variant: "ef" as string }));
const account = vi.hoisted(() => ({
  token: "tok" as string,
  friends: null as FriendsData | null,
  runFriendAction: vi.fn(async (): Promise<string | null> => null),
}));

vi.mock("@/context/LiveDataContext", () => ({ useLiveData: () => live }));
vi.mock("@/context/GameContext", () => ({
  useGame: () => ({ status: { variant: game.variant } }),
}));
vi.mock("@/context/SettingsContext", () => ({
  useSettings: () => ({ settings: { auth_token: account.token } }),
}));
vi.mock("@/context/FriendsContext", () => ({
  useFriends: () => ({
    friends: account.friends,
    runFriendAction: account.runFriendAction,
  }),
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
  account.token = "tok";
  // One of each standing the roster can find a listed player in, so only
  // "ash" is left to be asked.
  account.friends = {
    me: { username: "me" },
    friends: [{ username: "briar" }],
    outgoing: [{ username: "cinder" }],
  };
  account.runFriendAction.mockResolvedValue(null);
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

  /** The roster button on a mode row, if the row has one. */
  const rosterButton = (label: string) =>
    modeRow(label).querySelector(".game-mode-players") as HTMLElement | null;

  it("offers a roster only on the modes somebody is in", () => {
    open();
    expect(rosterButton("Solos")).not.toBeNull();
    expect(rosterButton("Duos")).toBeNull();
  });

  /* What the roster does with the names is RosterModal's own spec; what the
     pill owes it is the mode that was clicked and nobody else's players. */
  it("hands the clicked mode's players to the roster", () => {
    open();
    fireEvent.click(rosterButton("Solos")!);

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Solos");
    expect(dialog.textContent).toContain("Elemental Fracture · NA");
    for (const player of ["ash", "briar", "cinder"]) {
      expect(dialog.textContent).toContain(player);
    }
    // The EU crowd is in another region's tab, and stays out of this list.
    expect(dialog.textContent).not.toContain("dusk");
  });

  it("keeps the balances' rosters apart", () => {
    open();
    // Classic solos carry a head count but no names from the sidecar.
    fireEvent.click(screen.getByRole("button", { name: /^Classic/ }));
    fireEvent.click(rosterButton("Solos")!);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Classic · NA");
    expect(dialog.textContent).toContain("No names reported");
  });

  // Queried off the DOM rather than by role: the modal roster hides whatever
  // is behind it from the accessibility tree, popover included.
  it("keeps the breakdown open behind the roster", () => {
    open();
    fireEvent.click(rosterButton("Solos")!);
    expect(
      document.querySelector('[data-slot="popover-content"]')
    ).not.toBeNull();
  });
});
