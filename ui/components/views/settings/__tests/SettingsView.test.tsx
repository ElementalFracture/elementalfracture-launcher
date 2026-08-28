import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  commands.getLauncherUpdate.mockResolvedValue({
    current: "3.0.2",
    remote: null,
    update: false,
  });
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
    commands.detectWrappers.mockResolvedValue([
      { command: "umu-run", label: "umu-run" },
    ]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "steam steam://rungameid/1815016993" })
    );

    await openAdvanced();
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(
      await screen.findByDisplayValue("steam steam://rungameid/1815016993")
    ).toBeTruthy();
  });

  it("shows only the picker when the saved command is one that was detected", async () => {
    commands.detectWrappers.mockResolvedValue([
      { command: "umu-run", label: "umu-run" },
    ]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "umu-run" })
    );

    await openAdvanced();
    expect(await screen.findByRole("combobox")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/umu-run/)).toBeNull();
  });

  it("falls back to a free-text box, and says so, when nothing was detected", async () => {
    commands.detectWrappers.mockResolvedValue([]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "" })
    );

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
      expect(
        screen.getByRole("switch", MINIMIZE).getAttribute("data-state")
      ).toBe("checked")
    );
    expect(
      screen.getByRole("switch", CLOSE_ON_LAUNCH).getAttribute("data-state")
    ).toBe("unchecked");
  });

  it("writes a toggle the moment it is flicked", async () => {
    render(<SettingsView />, { wrapper: Providers });
    (await screen.findByRole("switch", MINIMIZE)).click();

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ minimize_on_close: true })
      )
    );
  });

  /* Each write spreads the whole of settings, so a second change that went out
     on the copy the first one replaced would silently undo it. Context's copy
     only catches up once the save resolves, which is the window this is in. */
  it("builds the second write on the first, not on a stale copy", async () => {
    render(<SettingsView />, { wrapper: Providers });
    (await screen.findByRole("switch", MINIMIZE)).click();
    screen.getByRole("switch", CLOSE_ON_LAUNCH).click();

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          minimize_on_close: true,
          close_on_launch: true,
        })
      )
    );
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
      screen
        .getByRole("switch", { ...ADVANCED, hidden: true })
        .getAttribute("data-state")
    ).toBe("checked");
    expect(screen.queryByText("Advanced")).toBeNull();
  });

  it("backing out of the warning leaves the panel closed and the switch off", async () => {
    render(<SettingsView />, { wrapper: Providers });

    (await screen.findByRole("switch", ADVANCED)).click();
    await waitFor(() => expect(screen.getByText("Back")).toBeTruthy());
    screen.getByText("Back").click();

    await waitFor(() =>
      expect(
        screen.getByRole("switch", ADVANCED).getAttribute("data-state")
      ).toBe("unchecked")
    );
    expect(screen.queryByText("Advanced")).toBeNull();
  });
});

/* The game version lives on the Game card; the launcher's rides in this card's
   own title, in the same faded brackets. */
describe("launcher version in the title", () => {
  const title = () =>
    Array.from(document.querySelectorAll('[data-slot="card-title"]')).find(
      (node) => node.textContent?.startsWith("Launcher")
    );

  it("carries the installed version in brackets", async () => {
    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(title()?.textContent).toBe("Launcher (v3.0.2)"));
    expect(title()?.querySelector(".title-note")?.textContent).toBe(
      " (v3.0.2)"
    );
  });

  /* It says what you are running, not what the CDN has — a newer one upstream
     is the update popup's business, and the check raises it. */
  it("stays on the installed version when the CDN is ahead", async () => {
    commands.getLauncherUpdate.mockResolvedValue({
      current: "3.0.2",
      remote: "3.1.0",
      update: false,
    });
    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(title()?.textContent).toBe("Launcher (v3.0.2)"));
  });

  it("is bare when the version can't be read", async () => {
    commands.getLauncherUpdate.mockResolvedValue({
      current: "",
      remote: null,
      update: false,
    });
    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(title()?.textContent).toBe("Launcher"));
    expect(title()?.querySelector(".title-note")).toBeNull();
  });
});

describe("checking for a launcher update", () => {
  const spinner = () => document.querySelector('[data-slot="spinner"]');
  const label = "Check for launcher updates";

  /* The fixture answers at once, which is the case the floor exists for:
     without it the spinner would appear and vanish inside a frame and the
     click would read as a no-op. */
  it("spins for a beat even when the answer is instant", async () => {
    render(<SettingsView />, { wrapper: Providers });
    const button = await screen.findByText(label);
    expect(spinner()).toBeNull();

    const started = Date.now();
    fireEvent.click(button);
    expect(spinner()).toBeTruthy();
    expect(screen.queryByText(label)).toBeNull();

    await waitFor(() => expect(screen.getByText(label)).toBeTruthy(), {
      timeout: 3000,
    });
    // Timers never fire early, so this is a floor, not a flaky race.
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    expect(spinner()).toBeNull();
  });
});

/* The text fields are the half that must not write per keystroke: each save is
   a disk write, and the URL ones re-pull what reads them. */
describe("advanced text fields", () => {
  const cdnBox = () => screen.getByLabelText(/CDN base/);

  beforeEach(() => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
  });

  it("holds the draft while you type", async () => {
    await openAdvanced();
    commands.saveSettings.mockClear();

    fireEvent.change(cdnBox(), { target: { value: "http://localhost:9000" } });
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });

  it("writes it once you leave the field", async () => {
    await openAdvanced();
    fireEvent.change(cdnBox(), { target: { value: "http://localhost:9000" } });
    fireEvent.blur(cdnBox());

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ cdn_base: "http://localhost:9000" })
      )
    );
  });

  it("trims what it writes", async () => {
    await openAdvanced();
    fireEvent.change(cdnBox(), {
      target: { value: "  http://localhost:9000  " },
    });
    fireEvent.blur(cdnBox());

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ cdn_base: "http://localhost:9000" })
      )
    );
  });

  it("costs nothing to tab through a field you didn't change", async () => {
    await openAdvanced();
    commands.saveSettings.mockClear();

    fireEvent.blur(cdnBox());
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });
});
