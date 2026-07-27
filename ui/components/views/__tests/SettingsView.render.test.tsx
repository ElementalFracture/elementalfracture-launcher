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

/** Advanced is opt-in behind a warning dialog; click through to reveal it.
 *  Nothing settings-backed renders outside Advanced any more (the Game panel
 *  moved to Mods & Install), so the individual assertions do the waiting. */
async function openAdvanced() {
  render(<SettingsView />, { wrapper: Providers });
  (await screen.findByRole("switch")).click();
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

describe("advanced options gate", () => {
  it("stays hidden until the warning is accepted", async () => {
    render(<SettingsView />, { wrapper: Providers });
    expect(screen.queryByText("Advanced")).toBeNull();

    (await screen.findByRole("switch")).click();
    await waitFor(() => expect(screen.getByText("Continue")).toBeTruthy());
    // The switch reads as on while the warning is up, so it doesn't flick
    // back. The open dialog aria-hides the rest of the tree, hence hidden.
    expect(screen.getByRole("switch", { hidden: true }).getAttribute("data-state")).toBe("checked");
    expect(screen.queryByText("Advanced")).toBeNull();
  });

  it("backing out of the warning leaves the panel closed and the switch off", async () => {
    render(<SettingsView />, { wrapper: Providers });

    (await screen.findByRole("switch")).click();
    await waitFor(() => expect(screen.getByText("Back")).toBeTruthy());
    screen.getByText("Back").click();

    await waitFor(() =>
      expect(screen.getByRole("switch").getAttribute("data-state")).toBe("unchecked")
    );
    expect(screen.queryByText("Advanced")).toBeNull();
  });
});

describe("version fields", () => {
  it("prefers the CDN version and notes what is installed alongside it", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    commands.getLauncherUpdate.mockResolvedValue({
      current: "3.0.2",
      remote: "3.1.0",
      update: false,
    });
    render(<SettingsView />, { wrapper: Providers });

    await waitFor(() => expect(screen.getByDisplayValue("v6.0.3")).toBeTruthy());
    expect(screen.getByDisplayValue("v3.1.0 (installed: v3.0.2)")).toBeTruthy();
  });

  it("falls back to the installed version when the CDN is unreachable", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: null }));
    render(<SettingsView />, { wrapper: Providers });

    await waitFor(() => expect(screen.getByDisplayValue("v6.0.2 (installed)")).toBeTruthy());
    expect(screen.getByDisplayValue("v3.0.2 (installed)")).toBeTruthy();
  });
});
