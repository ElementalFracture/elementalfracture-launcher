import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeView } from "../HomeView";
import { LocaleGate } from "@/i18n/LocaleGate";
import { fr } from "@/i18n/locales/fr";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { LiveDataProvider } from "@/context/LiveDataContext";
import { UIProvider } from "@/context/UIContext";
import { makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  detectWrappers: vi.fn(),
  getStatus: vi.fn(),
  getVersions: vi.fn(),
  getLauncherUpdate: vi.fn(),
  updatePatch: vi.fn(),
  launchGame: vi.fn(),
  quitLauncher: vi.fn(),
  getPlayers: vi.fn(),
  getEvents: vi.fn(),
  getNews: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn(), toastOnce: vi.fn() }));

const Providers = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameProvider>
      <LiveDataProvider>
        <UIProvider>{children}</UIProvider>
      </LiveDataProvider>
    </GameProvider>
  </SettingsProvider>
);

/* Home reads the language the same way the app does — through the gate, off
   the saved setting — rather than by having a locale pushed into it. */
const renderHome = () =>
  render(
    <LocaleGate>
      <HomeView />
    </LocaleGate>,
    { wrapper: Providers }
  );

beforeEach(() => {
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
});

describe("the banner", () => {
  /* Against the catalogue rather than a quoted sentence: the copy itself is
     still being revised, and what this has to catch is the hero rendering
     English — or reaching for the wrong key — not a reworded line. */
  it("draws the hero copy in the saved language", async () => {
    renderHome();
    expect(await screen.findByText(fr.home.hero.efTitle)).toBeTruthy();
    expect(screen.getByText(fr.home.hero.efSub)).toBeTruthy();
  });

  /* The copy rides in state across the variant fade, so it is seeded once and
     only replaced when the variant changes — a language it was seeded in
     before the status arrived would stick. */
  it("keeps the hero on the language when the variant is not the default", async () => {
    commands.getStatus.mockResolvedValue(makeStatus({ variant: "classic" }));
    renderHome();
    expect(await screen.findByText(fr.home.hero.classicTitle)).toBeTruthy();
  });

  it("translates the launch plate, label and tooltip alike", async () => {
    renderHome();
    const plate = await screen.findByTitle("Lancer Spellbreak");
    expect(plate.textContent).toBe("Lancer");
  });

  it("translates the update plate and the line under it", async () => {
    commands.getVersions.mockResolvedValue(
      makeVersions({ local: "6.0.2", remote: "6.0.3" })
    );
    renderHome();
    expect(
      await screen.findByTitle("Télécharger la mise à jour v6.0.3")
    ).toBeTruthy();
    expect(
      screen.getByText(fr.home.launch.hint.replace("{version}", "6.0.3"))
    ).toBeTruthy();
  });

  /* "METTRE À JOUR" is half again as long as "UPDATE" on a fixed-width piece
     of art, so it takes the smallest of the three label sizes. */
  it("steps the plate label down for a label a translation made longer", async () => {
    commands.getVersions.mockResolvedValue(
      makeVersions({ local: "6.0.2", remote: "6.0.3" })
    );
    renderHome();
    const label = (await screen.findByTitle(/Télécharger la mise à jour/))
      .firstElementChild;
    expect(label?.className).toContain("longest");
  });

  it("translates the install prompt when there is nothing to launch", async () => {
    commands.getStatus.mockResolvedValue(
      makeStatus({ game_path: "", exe_present: false })
    );
    renderHome();
    expect(await screen.findByText(fr.home.install.noInstall)).toBeTruthy();
    expect(screen.getByText(fr.home.install.locate)).toBeTruthy();
  });
});

describe("the rows below it", () => {
  it("translates the news heading", async () => {
    renderHome();
    expect(await screen.findByText(fr.home.news.title)).toBeTruthy();
    expect(screen.queryByText("What’s new")).toBeNull();
  });

  it("agrees the interested count with the language's own plural rules", async () => {
    commands.getEvents.mockResolvedValue({
      status: "ok",
      data: {
        events: [
          { name: "Solo Cup", status: "ACTIVE", interested: 1 },
          { name: "Duo Cup", status: "UPCOMING", interested: 12 },
        ],
      },
    });
    renderHome();

    expect(await screen.findByText("Événements en direct")).toBeTruthy();
    expect(screen.getByText("1 intéressé")).toBeTruthy();
    expect(screen.getByText("12 intéressés")).toBeTruthy();
    expect(screen.getByText("EN DIRECT")).toBeTruthy();
  });
});
