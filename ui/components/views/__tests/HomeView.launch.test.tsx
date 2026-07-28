import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { HomeView } from "../HomeView";
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
vi.mock("@/lib/toast", () => ({
  toast: vi.fn(),
  toastOnce: vi.fn(),
  useToastState: () => null,
}));

const Providers = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameProvider>
      <LiveDataProvider>
        <UIProvider>{children}</UIProvider>
      </LiveDataProvider>
    </GameProvider>
  </SettingsProvider>
);

beforeEach(() => {
  commands.getSettings.mockResolvedValue(makeSettings());
  commands.detectWrappers.mockResolvedValue([]);
  commands.getStatus.mockResolvedValue(makeStatus());
  commands.getVersions.mockResolvedValue(makeVersions());
  commands.getLauncherUpdate.mockResolvedValue({ current: "3.0.2", remote: null, update: false });
  commands.launchGame.mockResolvedValue({ status: "ok", data: null });
  commands.quitLauncher.mockResolvedValue(null);
  commands.getPlayers.mockResolvedValue({ status: "ok", data: {} });
  commands.getEvents.mockResolvedValue({ status: "ok", data: { events: [] } });
  commands.getNews.mockResolvedValue({ status: "ok", data: [] });
});

afterEach(() => vi.useRealTimers());

/** Render, wait for the install to register, and press Launch. */
async function launch() {
  render(<HomeView />, { wrapper: Providers });
  const btn = await screen.findByTitle("Launch Spellbreak");
  await act(async () => {
    btn.click();
  });
}

describe("close on launch", () => {
  it("quits the launcher once the game is on its way", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ close_on_launch: true }));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await launch();
    await waitFor(() => expect(commands.launchGame).toHaveBeenCalled());
    // Deliberately delayed, so the toast shows and the game process is spawned
    // before the window goes away.
    expect(commands.quitLauncher).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });
    expect(commands.quitLauncher).toHaveBeenCalled();
  });

  it("stays open when the setting is off", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await launch();
    await waitFor(() => expect(commands.launchGame).toHaveBeenCalled());
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(commands.quitLauncher).not.toHaveBeenCalled();
  });

  it("does not quit when the launch itself failed", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ close_on_launch: true }));
    commands.launchGame.mockResolvedValue({ status: "error", error: "no wrapper" });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await launch();
    await waitFor(() => expect(commands.launchGame).toHaveBeenCalled());
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(commands.quitLauncher).not.toHaveBeenCalled();
  });
});
