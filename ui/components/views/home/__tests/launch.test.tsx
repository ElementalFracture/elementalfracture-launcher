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

describe("a pending game update", () => {
  const outdated = () => makeVersions({ local: "6.0.2", remote: "6.0.3" });

  it("takes the button over instead of launching", async () => {
    commands.getVersions.mockResolvedValue(outdated());
    commands.updatePatch.mockResolvedValue({ status: "ok", data: "6.0.3" });

    render(<HomeView />, { wrapper: Providers });
    const btn = await screen.findByTitle("Download game update v6.0.3");
    expect(screen.queryByTitle("Launch Spellbreak")).toBeNull();

    await act(async () => {
      btn.click();
    });
    expect(commands.updatePatch).toHaveBeenCalled();
    expect(commands.launchGame).not.toHaveBeenCalled();
  });

  it("gives Launch back once the patch lands", async () => {
    commands.getVersions.mockResolvedValue(outdated());
    // The patch is what makes the install current, so the versions read after
    // it agree — which is what hands the button back.
    commands.updatePatch.mockImplementation(async () => {
      commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.3", remote: "6.0.3" }));
      return { status: "ok", data: "6.0.3" };
    });

    render(<HomeView />, { wrapper: Providers });
    const btn = await screen.findByTitle("Download game update v6.0.3");
    await act(async () => {
      btn.click();
    });
    expect(await screen.findByTitle("Launch Spellbreak")).toBeTruthy();
  });

  it("leaves Launch alone when the CDN version can't be read", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: null }));

    render(<HomeView />, { wrapper: Providers });
    expect(await screen.findByTitle("Launch Spellbreak")).toBeTruthy();
  });
});

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
