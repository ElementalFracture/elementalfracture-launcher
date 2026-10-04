import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SettingsView } from "../SettingsView";
import { LocaleGate } from "@/i18n/LocaleGate";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { LiveDataProvider } from "@/context/LiveDataContext";
import { UIProvider, useUI } from "@/context/UIContext";
import { makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  resetSettings: vi.fn(),
  detectWrappers: vi.fn(),
  detectProtons: vi.fn(),
  pickGameDir: vi.fn(),
  getStatus: vi.fn(),
  getVersions: vi.fn(),
  getLauncherUpdate: vi.fn(),
  updatePatch: vi.fn(),
  getPlayers: vi.fn(),
  getEvents: vi.fn(),
  getNews: vi.fn(),
  steamStatus: vi.fn(),
  steamCompatTools: vi.fn(),
  steamSetShortcut: vi.fn(),
  steamGameId: vi.fn(),
  steamCompatTool: vi.fn(),
  steamSetCompatTool: vi.fn(),
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
  commands.detectProtons.mockResolvedValue([]);
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
  commands.steamStatus.mockResolvedValue({ found: false });
  commands.steamCompatTools.mockResolvedValue([]);
  commands.steamGameId.mockResolvedValue(null);
  commands.steamCompatTool.mockResolvedValue(null);
});

/* The Language card has a picker of its own, so a bare combobox query would
   match either one. Scope to the wrapper's own card: on Custom… the label
   points at the text box rather than the picker, so the picker has no
   accessible name to find it by. */
const wrapperCard = () =>
  Array.from(document.querySelectorAll('[data-slot="card"]')).find((card) =>
    card
      .querySelector('[data-slot="card-title"]')
      ?.textContent?.startsWith("Launch wrapper")
  );
const wrapperPicker = () =>
  wrapperCard()?.querySelector('[data-slot="select-trigger"]') ?? null;

describe("launch wrapper picker", () => {
  it("keeps the picker on screen when the saved command is a custom one", async () => {
    // Replacing the picker with a bare text box strands the user on Custom —
    // there is no way back to a detected wrapper without a restart.
    commands.detectWrappers.mockResolvedValue([
      { command: "umu-run", label: "umu-run" },
    ]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "gamemoderun umu-run" })
    );

    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(wrapperPicker()).toBeTruthy());
    expect(await screen.findByDisplayValue("gamemoderun umu-run")).toBeTruthy();
  });

  it("shows only the picker when the saved command is one that was detected", async () => {
    commands.detectWrappers.mockResolvedValue([
      { command: "umu-run", label: "umu-run" },
    ]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "umu-run" })
    );

    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(wrapperPicker()).toBeTruthy());
    expect(screen.queryByPlaceholderText(/umu-run/)).toBeNull();
  });

  /* The picker stays, for Steam: it needs nothing installed to offer. */
  it("opens a free-text box, and says so, when nothing was detected", async () => {
    commands.detectWrappers.mockResolvedValue([]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "" })
    );

    render(<SettingsView />, { wrapper: Providers });
    expect(await screen.findByPlaceholderText(/none detected/)).toBeTruthy();
    expect(wrapperPicker()).toBeTruthy();
  });

  const ID_BOX = { name: /Steam game id/ };

  it("fills the Steam game id in from the game's shortcut", async () => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
    commands.steamGameId.mockResolvedValue("18150169937639899136");
    commands.detectWrappers.mockResolvedValue([
      { command: "umu-run", label: "umu-run" },
    ]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "umu-run" })
    );

    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(wrapperPicker()).toBeTruthy());
    fireEvent.click(wrapperPicker()!);
    fireEvent.click(await screen.findByRole("option", { name: "Steam" }));

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          launch_command: "steam steam://rungameid/18150169937639899136",
        })
      )
    );
    expect(
      (await screen.findByRole("textbox", ID_BOX)).getAttribute("value")
    ).toBe("18150169937639899136");
    expect(
      screen.getByText("Detected from the game's Steam shortcut.")
    ).toBeTruthy();
  });

  /* A different id the player saved stays; the shortcut's is offered beside
     it to copy, not swapped in. */
  it("shows the shortcut's id to copy when the saved one differs", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    commands.steamGameId.mockResolvedValue("18150169937639899136");
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "steam steam://rungameid/4225915749" })
    );

    render(<SettingsView />, { wrapper: Providers });
    expect(
      (await screen.findByRole("textbox", ID_BOX)).getAttribute("value")
    ).toBe("4225915749");
    expect(
      await screen.findByText("Elemental Fracture game id detected is:")
    ).toBeTruthy();
    fireEvent.click(
      await screen.findByRole("button", { name: "18150169937639899136" })
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("18150169937639899136")
    );
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });

  /* No shortcut to read it off: the player pastes what the guide has them
     copy out of Steam's desktop shortcut. */
  it("asks for the Steam game id when there is no shortcut", async () => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
    commands.detectWrappers.mockResolvedValue([
      { command: "umu-run", label: "umu-run" },
    ]);
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "umu-run" })
    );

    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(wrapperPicker()).toBeTruthy());
    fireEvent.click(wrapperPicker()!);
    fireEvent.click(await screen.findByRole("option", { name: "Steam" }));

    const box = await screen.findByRole("textbox", ID_BOX);
    expect(commands.saveSettings).not.toHaveBeenCalled();
    fireEvent.blur(box, {
      target: { value: "Exec=steam steam://rungameid/4225915749" },
    });
    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          launch_command: "steam steam://rungameid/4225915749",
        })
      )
    );
  });
});

describe("Proton picker", () => {
  const CACHYOS = {
    path: "/usr/share/steam/compatibilitytools.d/proton-cachyos-slr",
    label: "proton-cachyos-11.0 (steam linux runtime)",
  };
  const PICKER = { name: /Proton version/ };

  beforeEach(() => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
    commands.detectWrappers.mockResolvedValue([
      { command: "umu-run", label: "umu-run" },
      { command: "wine", label: "wine" },
    ]);
    commands.detectProtons.mockResolvedValue([CACHYOS]);
  });

  it("writes the picked build as proton_path", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "umu-run" })
    );
    render(<SettingsView />, { wrapper: Providers });

    fireEvent.click(await screen.findByRole("combobox", PICKER));
    fireEvent.click(await screen.findByRole("option", { name: CACHYOS.label }));

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ proton_path: CACHYOS.path })
      )
    );
  });

  /* Plain Wine never gets a PROTONPATH, so a pick there would do nothing. */
  it("is hidden when the wrapper doesn't run through Proton", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "wine" })
    );
    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(wrapperPicker()).toBeTruthy());
    expect(screen.queryByRole("combobox", PICKER)).toBeNull();
  });

  /* The launch falls back to Automatic for a build that has gone; the picker
     says so instead of showing a different build as the one in use. */
  it("marks a saved build that is no longer installed", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({
        launch_command: "umu-run",
        proton_path: "/home/p/.steam/root/compatibilitytools.d/GE-Proton8-1",
      })
    );
    render(<SettingsView />, { wrapper: Providers });
    expect(
      await screen.findByText(
        "/home/p/.steam/root/compatibilitytools.d/GE-Proton8-1 (not installed — Automatic is used)"
      )
    ).toBeTruthy();
  });
});

/* Steam's own per-game compatibility setting, under the Steam option. */
describe("Proton version under the Steam option", () => {
  const CACHYOS = {
    path: "/usr/share/steam/compatibilitytools.d/proton-cachyos-slr",
    label: "proton-cachyos-11.0 (steam linux runtime)",
    tool: "proton-cachyos-slr",
  };
  const PICKER = { name: /Proton version/ };

  beforeEach(() => {
    commands.steamCompatTools.mockResolvedValue([CACHYOS]);
    commands.steamSetCompatTool.mockResolvedValue({ status: "ok", data: null });
  });

  it("forces the picked build on the game behind the saved id", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({
        launch_command: "steam steam://rungameid/18150169937639899136",
      })
    );
    render(<SettingsView />, { wrapper: Providers });

    fireEvent.click(await screen.findByRole("combobox", PICKER));
    fireEvent.click(await screen.findByRole("option", { name: CACHYOS.label }));
    await waitFor(() =>
      expect(commands.steamSetCompatTool).toHaveBeenCalledWith(
        "18150169937639899136",
        "proton-cachyos-slr"
      )
    );
  });

  it("isn't there until a Steam game id is saved", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ launch_command: "wine" })
    );
    render(<SettingsView />, { wrapper: Providers });
    await waitFor(() => expect(wrapperPicker()).toBeTruthy());
    expect(screen.queryByRole("combobox", PICKER)).toBeNull();
  });
});

describe("Steam shortcut on Linux", () => {
  const CACHYOS = {
    path: "/usr/share/steam/compatibilitytools.d/proton-cachyos-slr",
    label: "proton-cachyos-11.0 (steam linux runtime)",
    tool: "proton-cachyos-slr",
  };
  const SWITCH = { name: "Add Elemental Fracture to Steam" };
  /* The Steam card only reads Steam while Settings is the view on screen. */
  const OnSettings = () => {
    const { setView } = useUI();
    useEffect(() => setView("settings"), [setView]);
    return <SettingsView />;
  };
  const closedSteam = {
    found: true,
    running: false,
    has_user: true,
    spellbreak_installed: false,
    linked: false,
    shortcut: false,
  };

  beforeEach(() => {
    commands.steamStatus.mockResolvedValue(closedSteam);
    commands.steamCompatTools.mockResolvedValue([CACHYOS]);
    commands.steamSetShortcut.mockResolvedValue({
      status: "ok",
      data: { ...closedSteam, shortcut: true },
    });
  });

  it("adds the game, set up as the guide does", async () => {
    render(<OnSettings />, { wrapper: Providers });
    const toggle = await screen.findByRole("switch", SWITCH);
    await waitFor(() =>
      expect(toggle.getAttribute("aria-disabled")).not.toBe("true")
    );
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(commands.steamSetShortcut).toHaveBeenCalledWith(true)
    );
  });

  /* Steam saves its config on exit and would undo the write. */
  it("can't be changed while Steam is running", async () => {
    commands.steamStatus.mockResolvedValue({ ...closedSteam, running: true });
    render(<OnSettings />, { wrapper: Providers });
    const toggle = await screen.findByRole("switch", SWITCH);
    fireEvent.click(toggle);
    expect(commands.steamSetShortcut).not.toHaveBeenCalled();
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

describe("the language picker", () => {
  beforeEach(() => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
  });

  /* SettingsView alone isn't enough: the locale comes from LocaleGate, which
     reads the saved setting back out. This is that round trip. */
  const renderApp = () =>
    render(
      <LocaleGate>
        <SettingsView />
      </LocaleGate>,
      { wrapper: Providers }
    );

  it("draws the UI in the saved language", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "fr" }));
    renderApp();
    expect(
      await screen.findByText("Réinitialiser les paramètres")
    ).toBeTruthy();
  });

  /* The "i" button has no text, only a tooltip and an accessible name, so an
     untranslated default here is invisible to every other assertion. */
  it("translates the info button that has no words of its own", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "fr" }));
    renderApp();
    expect(
      await screen.findAllByRole("button", { name: "Plus d'informations" })
    ).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "More info" })).toBeNull();
  });

  it("falls back to English for a language with no catalogue", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "de" }));
    renderApp();
    expect(await screen.findByText("Reset settings")).toBeTruthy();
  });

  /* No restart, no reload: the write lands, LocaleGate sees the new setting
     and the tree re-renders in the new language. */
  it("switches the UI as soon as a language is picked", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "" }));
    renderApp();
    await screen.findByText("Reset settings");

    fireEvent.click(
      await screen.findByRole("combobox", { name: /Display language/ })
    );
    fireEvent.click(await screen.findByRole("option", { name: "Français" }));

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ language: "fr" })
      )
    );
    expect(
      await screen.findByText("Réinitialiser les paramètres")
    ).toBeTruthy();
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
    await waitFor(() => expect(title()?.textContent).toBe("Launcher(v3.0.2)"));
    expect(title()?.querySelector(".title-note")?.textContent).toBe("(v3.0.2)");
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
    await waitFor(() => expect(title()?.textContent).toBe("Launcher(v3.0.2)"));
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
   a disk write, and these re-pull what reads them. */
describe("URL text fields", () => {
  const cdnBox = () => screen.getByLabelText(/CDN base/);

  beforeEach(() => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
  });

  it("holds the draft while you type", async () => {
    render(<SettingsView />, { wrapper: Providers });
    await screen.findByLabelText(/CDN base/);
    commands.saveSettings.mockClear();

    fireEvent.change(cdnBox(), { target: { value: "http://localhost:9000" } });
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });

  it("writes it once you leave the field", async () => {
    render(<SettingsView />, { wrapper: Providers });
    await screen.findByLabelText(/CDN base/);
    fireEvent.change(cdnBox(), { target: { value: "http://localhost:9000" } });
    fireEvent.blur(cdnBox());

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ cdn_base: "http://localhost:9000" })
      )
    );
  });

  it("trims what it writes", async () => {
    render(<SettingsView />, { wrapper: Providers });
    await screen.findByLabelText(/CDN base/);
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
    render(<SettingsView />, { wrapper: Providers });
    await screen.findByLabelText(/CDN base/);
    commands.saveSettings.mockClear();

    fireEvent.blur(cdnBox());
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });
});
