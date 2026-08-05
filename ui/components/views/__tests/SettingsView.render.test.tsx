import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SettingsView } from "../SettingsView";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { LiveDataProvider } from "@/context/LiveDataContext";
import { UIProvider } from "@/context/UIContext";
import { makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  resetSettings: vi.fn(),
  applyToken: vi.fn(),
  detectWrappers: vi.fn(),
  pickGameDir: vi.fn(),
  getStatus: vi.fn(),
  getVersions: vi.fn(),
  getLauncherUpdate: vi.fn(),
  updatePatch: vi.fn(),
  getPlayers: vi.fn(),
  getEvents: vi.fn(),
  getNews: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));

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
  commands.getPlayers.mockResolvedValue({ status: "ok", data: {} });
  commands.getEvents.mockResolvedValue({ status: "ok", data: { events: [] } });
  commands.getNews.mockResolvedValue({ status: "ok", data: [] });
});

/** The Launcher panel has switches of its own, so every switch query here
 *  names the row it belongs to. */
const ADVANCED = { name: "Show advanced options" };

/** Advanced is opt-in behind a warning dialog; click through to reveal it. */
async function openAdvanced() {
  render(<SettingsView />, { wrapper: Providers });
  (await screen.findByRole("switch", ADVANCED)).click();
  (await screen.findByText("Continue")).click();
  await screen.findByText("Advanced");
}

describe("launch wrapper picker", () => {
  it("keeps the picker on screen when the saved command is a custom one", async () => {
    // Replacing the picker with a bare text box strands the user on Custom —
    // there is no way back to a detected wrapper without a restart.
    commands.detectWrappers.mockResolvedValue([{ command: "umu-run", label: "umu-run" }]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "steam steam://rungameid/1815016993" })
    );

    await openAdvanced();
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(await screen.findByDisplayValue("steam steam://rungameid/1815016993")).toBeTruthy();
  });

  it("shows only the picker when the saved command is one that was detected", async () => {
    commands.detectWrappers.mockResolvedValue([{ command: "umu-run", label: "umu-run" }]);
    commands.getSettings.mockResolvedValue(makeSettings({ launch_command: "umu-run" }));

    await openAdvanced();
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/umu-run/)).toBeNull();
  });

  it("falls back to a free-text box, and says so, when nothing was detected", async () => {
    commands.detectWrappers.mockResolvedValue([]);
    commands.getSettings.mockResolvedValue(makeSettings({ launch_command: "" }));

    await openAdvanced();
    expect(await screen.findByPlaceholderText(/none detected/)).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("launcher panel", () => {
  const MINIMIZE = { name: "Minimize to taskbar when closing (X)" };
  const CLOSE_ON_LAUNCH = { name: "Close launcher when the game starts" };

  beforeEach(() => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
    commands.pickGameDir.mockResolvedValue(null);
    commands.updatePatch.mockResolvedValue({ status: "ok", data: "6.0.3" });
  });

  it("shows the saved window behaviors", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ minimize_on_close: true, close_on_launch: false })
    );
    render(<SettingsView />, { wrapper: Providers });

    await waitFor(() =>
      expect(screen.getByRole("switch", MINIMIZE).getAttribute("data-state")).toBe("checked")
    );
    expect(screen.getByRole("switch", CLOSE_ON_LAUNCH).getAttribute("data-state")).toBe(
      "unchecked"
    );
  });

  it("persists both toggles on save", async () => {
    // Save spreads the loaded settings; a toggle left out of that spread reads
    // as on until the next restart and then silently reverts.
    render(<SettingsView />, { wrapper: Providers });
    (await screen.findByRole("switch", MINIMIZE)).click();
    screen.getByRole("switch", CLOSE_ON_LAUNCH).click();
    // Save reads the toggles from its render's closure, so let both flushes
    // land before pressing it or the assertion tests a stale form.
    await waitFor(() =>
      expect(screen.getByRole("switch", CLOSE_ON_LAUNCH).getAttribute("data-state")).toBe("checked")
    );
    screen.getByText("Save settings").click();

    await waitFor(() => expect(commands.saveSettings).toHaveBeenCalled());
    expect(commands.saveSettings.mock.calls[0][0]).toMatchObject({
      minimize_on_close: true,
      close_on_launch: true,
    });
  });

  it("saves a newly picked game folder on the spot and brings it current", async () => {
    // The folder isn't part of the Save form — the install work that follows
    // needs it written first.
    commands.pickGameDir.mockResolvedValue("/games/new-spellbreak");
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    render(<SettingsView />, { wrapper: Providers });

    (await screen.findByText("Browse…")).click();
    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ game_path: "/games/new-spellbreak" })
      )
    );
    await waitFor(() => expect(commands.updatePatch).toHaveBeenCalled());
  });

  it("leaves the folder alone when the picker is dismissed", async () => {
    commands.pickGameDir.mockResolvedValue(null);
    render(<SettingsView />, { wrapper: Providers });

    (await screen.findByText("Browse…")).click();
    await waitFor(() => expect(commands.pickGameDir).toHaveBeenCalled());
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });
});

describe("advanced options gate", () => {
  it("stays hidden until the warning is accepted", async () => {
    render(<SettingsView />, { wrapper: Providers });
    expect(screen.queryByText("Advanced")).toBeNull();

    (await screen.findByRole("switch", ADVANCED)).click();
    await waitFor(() => expect(screen.getByText("Continue")).toBeTruthy());
    // The switch reads as on while the warning is up, so it doesn't flick
    // back. The open dialog aria-hides the rest of the tree, hence hidden.
    expect(
      screen.getByRole("switch", { ...ADVANCED, hidden: true }).getAttribute("data-state")
    ).toBe("checked");
    expect(screen.queryByText("Advanced")).toBeNull();
  });

  it("backing out of the warning leaves the panel closed and the switch off", async () => {
    render(<SettingsView />, { wrapper: Providers });

    (await screen.findByRole("switch", ADVANCED)).click();
    await waitFor(() => expect(screen.getByText("Back")).toBeTruthy());
    screen.getByText("Back").click();

    await waitFor(() =>
      expect(screen.getByRole("switch", ADVANCED).getAttribute("data-state")).toBe("unchecked")
    );
    expect(screen.queryByText("Advanced")).toBeNull();
  });
});

/* The game version lives in Game Settings now; only the launcher's is here. */
describe("launcher version field", () => {
  it("prefers the CDN version and notes what is installed alongside it", async () => {
    commands.getLauncherUpdate.mockResolvedValue({
      current: "3.0.2",
      remote: "3.1.0",
      update: false,
    });
    render(<SettingsView />, { wrapper: Providers });

    await waitFor(() =>
      expect(screen.getByDisplayValue("v3.1.0 (installed: v3.0.2)")).toBeTruthy()
    );
  });

  it("falls back to the installed version when the CDN is unreachable", async () => {
    render(<SettingsView />, { wrapper: Providers });

    await waitFor(() => expect(screen.getByDisplayValue("v3.0.2 (installed)")).toBeTruthy());
  });
});
