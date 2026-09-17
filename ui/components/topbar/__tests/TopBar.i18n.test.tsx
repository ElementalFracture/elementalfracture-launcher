import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountPill } from "../AccountPill";
import { PlayersPill } from "../PlayersPill";
import { GameVariantPill } from "../GameVariantPill";
import { LocaleGate } from "@/i18n/LocaleGate";
import { fr } from "@/i18n/locales/fr";
import { SettingsProvider } from "@/context/SettingsContext";
import { FriendsProvider } from "@/context/FriendsContext";
import { GameProvider } from "@/context/GameContext";
import { LiveDataProvider } from "@/context/LiveDataContext";
import { makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  detectWrappers: vi.fn(),
  getStatus: vi.fn(),
  getVersions: vi.fn(),
  getLauncherUpdate: vi.fn(),
  getPlayers: vi.fn(),
  getEvents: vi.fn(),
  getNews: vi.fn(),
  friendsList: vi.fn(),
  friendAdd: vi.fn(),
  friendAccept: vi.fn(),
  friendRemove: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn(), toastOnce: vi.fn() }));

const Providers = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameProvider>
      <LiveDataProvider>
        <FriendsProvider>{children}</FriendsProvider>
      </LiveDataProvider>
    </GameProvider>
  </SettingsProvider>
);

const renderFr = (ui: ReactNode) =>
  render(<LocaleGate>{ui}</LocaleGate>, { wrapper: Providers });

/* Everything below reads its expected wording out of `fr` rather than quoting
   it. The copy is still being revised, and what these have to catch is a
   string that never reached the catalogue — not a reworded one. */

/** A catalogue string as it renders: without its emphasis markers. */
const plain = (text: string) => text.split("*").join("");

/** The run a catalogue string marked for emphasis. */
const marked = (text: string) => text.match(/\*([^*]+)\*/)?.[1] ?? "";

/** Match a whole sentence even when a <strong> has split it across nodes. */
const sentence = (text: string) =>
  screen.findByText(
    (_content, node) => node?.tagName === "P" && node.textContent === text
  );

beforeEach(() => {
  vi.clearAllMocks();
  commands.getSettings.mockResolvedValue(makeSettings({ language: "fr" }));
  commands.detectWrappers.mockResolvedValue([]);
  commands.getStatus.mockResolvedValue(makeStatus());
  commands.getVersions.mockResolvedValue(makeVersions());
  commands.getLauncherUpdate.mockResolvedValue({
    current: "3.0.2",
    remote: null,
    update: false,
  });
  commands.getPlayers.mockResolvedValue({ status: "ok", data: {} });
  commands.getEvents.mockResolvedValue({ status: "ok", data: { events: [] } });
  commands.getNews.mockResolvedValue({ status: "ok", data: [] });
  commands.friendsList.mockResolvedValue({
    status: "ok",
    data: {
      ok: true,
      me: { username: "Lytion" },
      friends: [],
      incoming: [],
      outgoing: [],
    },
  });
});

describe("the players pill", () => {
  it("translates the pill and its empty breakdown", async () => {
    renderFr(<PlayersPill />);
    const pill = await screen.findByTitle(fr.topbar.players.title);
    // Before the first answer the count is a dash, which French files with
    // the singular (0 and 1 take "one").
    expect(pill.textContent).toContain(fr.topbar.players.label);

    fireEvent.click(pill);
    expect(await screen.findByText(fr.topbar.players.empty)).toBeTruthy();
  });

  it("translates the totals and keeps the mode rows", async () => {
    commands.getPlayers.mockResolvedValue({
      status: "ok",
      data: {
        online: 7,
        total: 9,
        in_menu: 2,
        servers: [
          { name: "solo-1", mode: "Solo", region: "EU", players: 4 },
          { name: "duos-1", mode: "Duo", region: "EU", players: 3 },
        ],
      },
    });
    renderFr(<PlayersPill />);
    const pill = await screen.findByTitle(fr.topbar.players.title);
    await waitFor(() =>
      expect(pill.textContent).toContain(`9 ${fr.topbar.players.label_other}`)
    );
    fireEvent.click(pill);

    expect(await screen.findByText(fr.topbar.players.inMenus)).toBeTruthy();
    expect(
      await screen.findByRole("rowheader", {
        name: fr.topbar.players.modes.solo,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("rowheader", { name: fr.topbar.players.modes.duo })
    ).toBeTruthy();
  });
});

describe("the variant pill", () => {
  /* The tab names are the balance's own name and stay put; the tooltip and the
     popover copy go through the catalogue. */
  it("keeps the balance names on the tabs but translates what explains them", async () => {
    renderFr(<GameVariantPill />);
    expect(
      await screen.findByRole("tab", { name: "Elemental Fracture" })
    ).toBeTruthy();
    expect(screen.getByTitle(fr.topbar.variant.efTitle)).toBeTruthy();

    fireEvent.click(screen.getByTitle(fr.topbar.variant.difference));
    /* One catalogue string per paragraph, name included — so the sentence that
       renders is that string with its emphasis markers taken out. */
    expect(await sentence(plain(fr.topbar.variant.efHelp))).toBeTruthy();
    expect(await sentence(plain(fr.topbar.variant.classicHelp))).toBeTruthy();
  });

  /* The emphasis is the catalogue's to place: a translation that moves the
     name, or drops the asterisks, must not need this component changed. */
  it("bolds whatever the catalogue marked, wherever it sits", async () => {
    renderFr(<GameVariantPill />);
    fireEvent.click(await screen.findByTitle(fr.topbar.variant.difference));

    const bolded = await screen.findAllByText(
      (_content, node) => node?.tagName === "STRONG"
    );
    expect(bolded.map((n) => n.textContent)).toEqual([
      marked(fr.topbar.variant.efHelp),
      marked(fr.topbar.variant.classicHelp),
    ]);
  });
});

describe("the account pill", () => {
  const settled = () =>
    waitFor(() => expect(commands.detectWrappers).toHaveBeenCalled());

  it("translates the guest pill", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ language: "fr", auth_token: "", username: "" })
    );
    renderFr(<AccountPill />);
    await settled();
    await waitFor(() =>
      expect(screen.getByTitle(fr.topbar.account.title).textContent).toContain(
        fr.topbar.account.guest
      )
    );
    expect(screen.getByTitle(fr.topbar.account.title).textContent).toContain(
      fr.topbar.account.signIn
    );
  });

  it("translates the drawer and the friend list inside it", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ language: "fr", auth_token: "tok", username: "Lytion" })
    );
    renderFr(<AccountPill />);
    await settled();
    await waitFor(() =>
      expect(screen.getByTitle(fr.topbar.account.title).textContent).toContain(
        "Lytion"
      )
    );

    fireEvent.click(screen.getByTitle(fr.topbar.account.title));
    expect(
      await screen.findByLabelText(fr.topbar.account.closeFriends)
    ).toBeTruthy();
    expect(screen.getByText(fr.friends.none)).toBeTruthy();
    expect(screen.getByTitle(fr.friends.addTitle)).toBeTruthy();
    expect(screen.getByText(fr.topbar.account.signOut)).toBeTruthy();
  });

  /* A row's "in game" line used to be chosen by comparing the rendered words
     against the English "in game" — true only while there was one language. */
  it("still marks an in-game friend once the words are French", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ language: "fr", auth_token: "tok", username: "Lytion" })
    );
    commands.friendsList.mockResolvedValue({
      status: "ok",
      data: {
        ok: true,
        me: { username: "Lytion" },
        friends: [{ username: "Doobs", status: "in_game" }],
        incoming: [],
        outgoing: [],
      },
    });
    renderFr(<AccountPill />);
    await settled();
    await waitFor(() =>
      expect(screen.getByTitle(fr.topbar.account.title).textContent).toContain(
        "Lytion"
      )
    );

    fireEvent.click(screen.getByTitle(fr.topbar.account.title));
    expect(await screen.findByText("Doobs")).toBeTruthy();
    expect(screen.getByText(fr.friends.inGame)).toBeTruthy();
    expect(screen.getByTitle(fr.friends.remove)).toBeTruthy();
  });
});
