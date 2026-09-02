import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { LocaleGate } from "@/i18n/LocaleGate";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { UIProvider } from "@/context/UIContext";
import { makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  detectWrappers: vi.fn(),
  getStatus: vi.fn(),
  getVersions: vi.fn(),
  getLauncherUpdate: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn(), toastOnce: vi.fn() }));

const Providers = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameProvider>
      <UIProvider>{children}</UIProvider>
    </GameProvider>
  </SettingsProvider>
);

const renderSidebar = () =>
  render(
    <LocaleGate>
      <Sidebar />
    </LocaleGate>,
    { wrapper: Providers }
  );

beforeEach(() => {
  commands.getSettings.mockResolvedValue(makeSettings());
  commands.detectWrappers.mockResolvedValue([]);
  commands.getStatus.mockResolvedValue(makeStatus());
  commands.getVersions.mockResolvedValue(makeVersions());
  commands.getLauncherUpdate.mockResolvedValue({
    current: "3.0.2",
    remote: null,
    update: false,
  });
});

/* Every button on the rail is an icon with a tooltip and nothing else, so a
   title left in English here is invisible to every other kind of assertion. */
describe("the tooltips, which are all the words the rail has", () => {
  it("names each destination in English by default", async () => {
    renderSidebar();
    expect(await screen.findByTitle("Home")).toBeTruthy();
    expect(screen.getByTitle("Game Settings")).toBeTruthy();
    expect(screen.getByTitle("Launcher Settings")).toBeTruthy();
    expect(screen.getByTitle("About")).toBeTruthy();
  });

  it("names them in the saved language instead", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "fr" }));
    renderSidebar();

    expect(await screen.findByTitle("Accueil")).toBeTruthy();
    expect(screen.getByTitle("Paramètres du jeu")).toBeTruthy();
    expect(screen.getByTitle("Paramètres du lanceur")).toBeTruthy();
    expect(screen.getByTitle("À propos")).toBeTruthy();
    expect(screen.queryByTitle("Home")).toBeNull();
  });
});

describe("navigation", () => {
  /* The titles are the only handle a test has on these buttons, so translating
     them is what would break this — worth pinning that they still act. */
  it("still switches view when picked by its translated tooltip", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "fr" }));
    renderSidebar();

    const mods = await screen.findByTitle("Paramètres du jeu");
    expect(mods.className).not.toContain("active");
    fireEvent.click(mods);
    expect(screen.getByTitle("Paramètres du jeu").className).toContain(
      "active"
    );
  });
});
