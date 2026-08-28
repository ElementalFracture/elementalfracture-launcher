import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModsView } from "../ModsView";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { UIProvider, useUI } from "@/context/UIContext";
import { makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  detectWrappers: vi.fn(),
  getStatus: vi.fn(),
  getVersions: vi.fn(),
  getLauncherUpdate: vi.fn(),
  updatePatch: vi.fn(),
  verifyInstall: vi.fn(),
  installMods: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));

const toasts = vi.hoisted(() => ({ toast: vi.fn(), toastOnce: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

/** The view re-verifies the install on selection, so tests have to select it. */
function SelectModsTab({ children }: { children: ReactNode }) {
  const { setView } = useUI();
  useEffect(() => setView("mods"), [setView]);
  return <>{children}</>;
}

const Providers = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameProvider>
      <UIProvider>
        <SelectModsTab>{children}</SelectModsTab>
      </UIProvider>
    </GameProvider>
  </SettingsProvider>
);

const renderMods = () => render(<ModsView />, { wrapper: Providers });

beforeEach(() => {
  commands.getSettings.mockResolvedValue(makeSettings());
  commands.detectWrappers.mockResolvedValue([]);
  commands.getStatus.mockResolvedValue(makeStatus());
  commands.getVersions.mockResolvedValue(makeVersions());
  commands.getLauncherUpdate.mockResolvedValue({ current: "3.0.2", remote: null, update: false });
  commands.verifyInstall.mockResolvedValue([{ name: "Elefrac.dll", present: true }]);
});

describe("game version field", () => {
  it("prefers the CDN version over what is installed", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    renderMods();
    await waitFor(() => expect(screen.getByDisplayValue("v6.0.3")).toBeTruthy());
  });

  it("falls back to the installed version when the CDN is unreachable", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: null }));
    renderMods();
    await waitFor(() => expect(screen.getByDisplayValue("v6.0.2 (installed)")).toBeTruthy());
  });
});

describe("version line", () => {
  it("names the launcher version alongside the game's", async () => {
    renderMods();
    await waitFor(() => expect(screen.getByText(/Game: v6\.0\.2/)).toBeTruthy());
    expect(screen.getByText(/Launcher: v3\.0\.2/)).toBeTruthy();
  });

  it("adds the CDN version only when it is known", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    renderMods();
    await waitFor(() => expect(screen.getByText(/Latest: v6\.0\.3/)).toBeTruthy());
  });

  it("omits the game version when the install has none", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: null, remote: null }));
    renderMods();
    await waitFor(() => expect(screen.getByText(/Launcher: v3\.0\.2/)).toBeTruthy());
    expect(screen.queryByText(/Game: v/)).toBeNull();
  });
});

describe("update button", () => {
  it("appears only when the install is behind the CDN", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    renderMods();
    await waitFor(() => expect(screen.getByText("Update game")).toBeTruthy());
  });

  it("stays hidden when the versions agree", async () => {
    renderMods();
    await waitFor(() => expect(screen.getByText(/Game: v6\.0\.2/)).toBeTruthy());
    expect(screen.queryByText("Update game")).toBeNull();
  });
});

describe("check for game updates", () => {
  const press = async () => {
    renderMods();
    const button = await screen.findByText("Check for game updates");
    fireEvent.click(button);
  };

  it("names the version it found — the check used to answer with silence", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    await press();
    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith(
        "Game update available (v6.0.3) — Launch it from Home."
      )
    );
  });

  it("says so when the install is current", async () => {
    await press();
    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith("Game is up to date")
    );
  });

  it("blames the CDN, not the install, when the version can't be read", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: null }));
    await press();
    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith(
        "Couldn't reach the update server, check the CDN base in Advanced.",
        true
      )
    );
  });
});

describe("mod status", () => {
  it("reports a complete install", async () => {
    renderMods();
    await waitFor(() => expect(screen.getByText("Mods are installed and ready.")).toBeTruthy());
    expect(screen.getByText("INSTALLED")).toBeTruthy();
  });

  it("distinguishes a partial install from no install at all", async () => {
    commands.verifyInstall.mockResolvedValue([
      { name: "Elefrac.dll", present: true },
      { name: "Injector.dll", present: false },
    ]);
    renderMods();
    await waitFor(() => expect(screen.getByText("Some mod files are missing.")).toBeTruthy());
    expect(screen.getByText("MISSING")).toBeTruthy();
    expect(screen.getByText(/1 of 2 file\(s\) missing/)).toBeTruthy();
  });

  it("says mods are absent when nothing is present", async () => {
    commands.verifyInstall.mockResolvedValue([
      { name: "Elefrac.dll", present: false },
      { name: "Injector.dll", present: false },
    ]);
    renderMods();
    await waitFor(() => expect(screen.getByText("Mods are not installed.")).toBeTruthy());
  });

  it("asks for a game folder first when none is set", async () => {
    commands.getStatus.mockResolvedValue(makeStatus({ game_path: "", exe_present: false }));
    renderMods();
    await waitFor(() => expect(screen.getByText(/Set the game folder first/)).toBeTruthy());
    expect(screen.queryByText("INSTALLED")).toBeNull();
  });
});

describe("game panel", () => {
  it("shows the configured folder", async () => {
    renderMods();
    await waitFor(() => expect(screen.getByText(/Game folder: \/games\/spellbreak/)).toBeTruthy());
  });

  it("prompts to locate or download when no folder is set", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ game_path: "" }));
    renderMods();
    await waitFor(() => expect(screen.getByText(/No game folder set/)).toBeTruthy());
  });

  it("offers both entry points", async () => {
    renderMods();
    await waitFor(() => expect(screen.getByText("Locate install")).toBeTruthy());
    expect(screen.getByText("Download game…")).toBeTruthy();
  });
});
