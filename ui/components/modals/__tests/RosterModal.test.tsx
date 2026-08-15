import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RosterModal, type Roster } from "../RosterModal";
import type { FriendsData } from "@/lib/rust";

const account = vi.hoisted(() => ({
  token: "tok" as string,
  friends: null as FriendsData | null,
  runFriendAction: vi.fn(async (): Promise<string | null> => null),
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

/* Out of order, and one player reported twice — the mode's two servers both
   named them, and they are still one person to add. */
const ROSTER: Roster = {
  region: "NA",
  variant: "Elemental Fracture",
  mode: "Solos",
  names: ["cinder", "ash", "me", "briar", "ash", "wren"],
};

const open = (roster: Roster | null = ROSTER) =>
  render(<RosterModal roster={roster} onClose={() => {}} />);

/** The players listed, in the order the dialog puts them in. */
const roster = () =>
  [...screen.getByRole("dialog").querySelectorAll(".roster-name")].map(
    (n) => n.textContent
  );

/** One player's row. */
const rosterRow = (player: string) =>
  screen
    .getByText(player, { selector: ".roster-name" })
    .closest(".roster-row") as HTMLElement;

const addButton = (player: string) =>
  rosterRow(player).querySelector(".roster-add") as HTMLElement | null;

beforeEach(() => {
  vi.clearAllMocks();
  account.token = "tok";
  // One of each standing the roster can find a listed player in, so only
  // "ash" is left to be asked.
  account.friends = {
    me: { username: "me" },
    friends: [{ username: "briar" }],
    outgoing: [{ username: "cinder" }],
    incoming: [{ username: "wren" }],
  };
  account.runFriendAction.mockResolvedValue(null);
});

describe("RosterModal", () => {
  it("stays shut until there is a mode to show", () => {
    open(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("heads the list with the mode it belongs to", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Solos");
    expect(dialog.textContent).toContain("Elemental Fracture · NA");
  });

  it("lists each player once, friends first and then by name", () => {
    open();
    expect(roster()).toEqual(["briar", "ash", "cinder", "me", "wren"]);
  });

  it("offers a friend request only to the players it can be sent to", () => {
    open();
    expect(addButton("ash")).not.toBeNull();
    for (const [player, tag] of [
      ["cinder", "requested"],
      ["me", "you"],
    ]) {
      expect(addButton(player)).toBeNull();
      expect(rosterRow(player).textContent).toContain(tag);
    }
  });

  /* An existing friend has no request to make, so the row carries a mark in
     place of the button rather than a word about a state they aren't in. */
  it("marks a friend's row instead of offering a request", () => {
    open();
    expect(addButton("briar")).toBeNull();
    expect(rosterRow("briar").textContent).toBe("briar");
    expect(
      screen.getByLabelText("briar is your friend").closest(".roster-row")
    ).toBe(rosterRow("briar"));
  });

  /* The mark is the friends' own: nobody else's standing wears one. */
  it("marks nobody but the friends", () => {
    open();
    expect(
      screen.getByRole("dialog").querySelectorAll(".roster-friend")
    ).toHaveLength(1);
  });

  it("sends the request for the player whose row was clicked", () => {
    open();
    fireEvent.click(addButton("ash")!);
    expect(account.runFriendAction).toHaveBeenCalledWith("add", "ash");
  });

  /* Someone who already asked is one button away from a friend, so their row
     keeps the button rather than reporting the request back at them. */
  it("takes the same button as an accept for a player who asked first", () => {
    open();
    const button = addButton("wren");
    expect(button).not.toBeNull();
    expect(rosterRow("wren").textContent).toBe("wren");
    fireEvent.click(button!);
    expect(account.runFriendAction).toHaveBeenCalledWith("accept", "wren");
  });

  it("puts a failed request in front of the player", async () => {
    account.runFriendAction.mockResolvedValue("No player with that username.");
    open();
    fireEvent.click(addButton("ash")!);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "No player with that username."
    );
  });

  /* The graph is unknown until the sidecar answers, so nobody is placed yet.
     The rows still offer the request — the token is what they need, not an
     answer about who these players are. */
  it("still offers the request before the friend graph is known", () => {
    account.friends = null;
    open();
    expect(roster().map((player) => addButton(player!))).not.toContain(null);
  });

  it("drops the request buttons when no token is set", () => {
    account.token = "";
    open();
    expect(screen.getByRole("dialog").querySelector(".roster-add")).toBeNull();
    // The names are still the point of the dialog, and stay.
    expect(roster()).toEqual(["briar", "ash", "cinder", "me", "wren"]);
  });

  it("says so when a busy mode reports no names", () => {
    open({ ...ROSTER, names: [] });
    expect(screen.getByRole("dialog").textContent).toContain(
      "No names reported"
    );
  });
});
