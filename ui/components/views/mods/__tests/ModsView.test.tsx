import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModsView } from "../ModsView";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { UIProvider, useUI } from "@/context/UIContext";
import { LocaleGate } from "@/i18n/LocaleGate";
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
  pickGameDir: vi.fn(),
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
  commands.getLauncherUpdate.mockResolvedValue({
    current: "3.0.2",
    remote: null,
    update: false,
  });
  commands.verifyInstall.mockResolvedValue([
    { name: "Elefrac.dll", present: true },
  ]);
});

describe("game title", () => {
  /* The version is its own dimmed span, so the title's text is split across
     elements and getByText can't see it whole — read the heading itself. */
  const title = () =>
    Array.from(document.querySelectorAll('[data-slot="card-title"]')).find(
      (node) => node.textContent?.startsWith("Game")
    );

  /* No space in textContent: the gap after the title is `.title-note`'s
     margin now, not a character in the markup. */
  it("carries the installed version in brackets", async () => {
    renderMods();
    await waitFor(() => expect(title()?.textContent).toBe("Game(v6.0.2)"));
    // And it is the faded span that carries it, not the title proper.
    expect(title()?.querySelector(".title-note")?.textContent).toBe("(v6.0.2)");
  });

  /* The title says what you have, not what the CDN offers — "Latest:" on the
     Mods card is where the remote version belongs, and two disagreeing version
     numbers on one screen is how you get a bug report. */
  it("stays on the installed version when the CDN is ahead", async () => {
    commands.getVersions.mockResolvedValue(
      makeVersions({ local: "6.0.2", remote: "6.0.3" })
    );
    renderMods();
    await waitFor(() => expect(title()?.textContent).toBe("Game(v6.0.2)"));
  });

  it("is bare when the install has no version", async () => {
    commands.getVersions.mockResolvedValue(
      makeVersions({ local: null, remote: null })
    );
    renderMods();
    await waitFor(() => expect(title()?.textContent).toBe("Game"));
    expect(title()?.querySelector(".title-note")).toBeNull();
  });
});

describe("update button", () => {
  it("appears only when the install is behind the CDN", async () => {
    commands.getVersions.mockResolvedValue(
      makeVersions({ local: "6.0.2", remote: "6.0.3" })
    );
    renderMods();
    await waitFor(() => expect(screen.getByText("Update game")).toBeTruthy());
  });

  it("stays hidden when the versions agree", async () => {
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Mods are installed and ready.")).toBeTruthy()
    );
    expect(screen.queryByText("Update game")).toBeNull();
  });
});

describe("check for game updates", () => {
  const press = async () => {
    renderMods();
    const button = await screen.findByText("Check for game updates");
    fireEvent.click(button);
  };

  /* The button spins for a second before it reports (MIN_SPIN_MS in GameCard),
     which outlasts waitFor's own 1s default — so every assertion about the
     result has to be given room to outwait the floor. */
  const reported = (assertion: () => void) =>
    waitFor(assertion, { timeout: 3000 });

  it("names the version it found — the check used to answer with silence", async () => {
    commands.getVersions.mockResolvedValue(
      makeVersions({ local: "6.0.2", remote: "6.0.3" })
    );
    await press();
    await reported(() =>
      expect(toasts.toast).toHaveBeenCalledWith(
        "Game update available (v6.0.3) — Launch it from Home."
      )
    );
  });

  it("says so when the install is current", async () => {
    await press();
    await reported(() =>
      expect(toasts.toast).toHaveBeenCalledWith("Game is up to date")
    );
  });

  it("blames the CDN, not the install, when the version can't be read", async () => {
    commands.getVersions.mockResolvedValue(
      makeVersions({ local: "6.0.2", remote: null })
    );
    await press();
    await reported(() =>
      expect(toasts.toast).toHaveBeenCalledWith(
        "Couldn't reach the update server, check the CDN base in Settings.",
        true
      )
    );
  });

  /* The fixture answers instantly, which is exactly the case the floor is for:
     without it the spinner would come and go inside a frame and the click would
     read as a no-op. */
  it("spins for a beat even when the answer is instant", async () => {
    const spinner = () => document.querySelector('[data-slot="spinner"]');
    renderMods();
    const button = await screen.findByText("Check for game updates");
    toasts.toast.mockClear();

    const started = Date.now();
    fireEvent.click(button);
    expect(spinner()).toBeTruthy();

    /* Long past the point the fixture's check has resolved, and still holding.
       Asserting only that the toast isn't *synchronous* would pass with no
       floor at all, since even a 0ms timer defers past the click. */
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(toasts.toast).not.toHaveBeenCalled();
    expect(spinner()).toBeTruthy();

    await reported(() =>
      expect(toasts.toast).toHaveBeenCalledWith("Game is up to date")
    );
    // Timers never fire early, so this is a floor, not a flaky race.
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    expect(spinner()).toBeNull();
    expect(screen.getByText("Check for game updates")).toBeTruthy();
  });

  /* Nothing to check against a folder with no game in it — the button only
     turns up once one has actually been found there. */
  it("is offered only once a game has been found", async () => {
    commands.getStatus.mockResolvedValue(makeStatus({ exe_present: false }));
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Locate install")).toBeTruthy()
    );
    expect(screen.queryByText("Check for game updates")).toBeNull();
  });
});

describe("picking the install location", () => {
  it("saves a newly picked folder on the spot", async () => {
    // Not part of any Save form: the install work that follows needs it
    // written first. Moved here with the field itself, from Settings.
    commands.pickGameDir.mockResolvedValue("/games/new-spellbreak");
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
    renderMods();

    fireEvent.click(await screen.findByText("Browse…"));
    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ game_path: "/games/new-spellbreak" })
      )
    );
  });

  it("leaves the folder alone when the picker is dismissed", async () => {
    commands.pickGameDir.mockResolvedValue(null);
    renderMods();
    // Earlier tests in this file save too; only this run's calls matter.
    commands.saveSettings.mockClear();

    fireEvent.click(await screen.findByText("Browse…"));
    await waitFor(() => expect(commands.pickGameDir).toHaveBeenCalled());
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });
});

describe("editing the install location", () => {
  const box = () => screen.getByLabelText("Install location");

  it("offers Save only while the box differs from what is saved", async () => {
    renderMods();
    await waitFor(() =>
      expect(screen.getByDisplayValue("/games/spellbreak")).toBeTruthy()
    );
    expect(screen.queryByText("Save")).toBeNull();

    fireEvent.change(box(), { target: { value: "/games/elsewhere" } });
    expect(screen.getByText("Save")).toBeTruthy();

    // Typed back to the saved value, so there is nothing to save again —
    // "was touched" would leave the button stranded here.
    fireEvent.change(box(), { target: { value: "/games/spellbreak" } });
    expect(screen.queryByText("Save")).toBeNull();
  });

  /* Browsing writes on the spot rather than waiting for a Save: there is
     nothing to confirm about a folder you just picked, and the provisioning
     that follows needs it written first. Moved here with the field itself,
     which used to live in Settings → Launcher. */
  it("saves a picked folder on the spot", async () => {
    commands.pickGameDir.mockResolvedValue("/games/new-spellbreak");
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
    renderMods();

    fireEvent.click(await screen.findByText("Browse…"));
    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ game_path: "/games/new-spellbreak" })
      )
    );
  });

  it("leaves the folder alone when the picker is dismissed", async () => {
    commands.pickGameDir.mockResolvedValue(null);
    renderMods();
    // Earlier tests in this file save too, and nothing clears between them.
    commands.saveSettings.mockClear();

    fireEvent.click(await screen.findByText("Browse…"));
    await waitFor(() => expect(commands.pickGameDir).toHaveBeenCalled());
    expect(commands.saveSettings).not.toHaveBeenCalled();
  });

  it("writes the typed path, trimmed", async () => {
    commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
    renderMods();
    await waitFor(() =>
      expect(screen.getByDisplayValue("/games/spellbreak")).toBeTruthy()
    );

    fireEvent.change(box(), { target: { value: "  /games/elsewhere  " } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(commands.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ game_path: "/games/elsewhere" })
      )
    );
    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith("Game folder updated")
    );
  });
});

describe("verify", () => {
  const spinner = () => document.querySelector('[data-slot="spinner"]');

  it("empties the card and spins, for long enough to be seen", async () => {
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Mods are installed and ready.")).toBeTruthy()
    );
    expect(spinner()).toBeNull();

    const started = Date.now();
    fireEvent.click(screen.getByText("Verify"));

    // What the card was showing is gone, and the spinner has taken its place.
    expect(spinner()).toBeTruthy();
    expect(screen.queryByText("Mods are installed and ready.")).toBeNull();
    expect(screen.queryByText("INSTALLED")).toBeNull();

    /* verifyInstall answers off the local disk, so with no floor the card would
       blank and repaint inside a frame. Timers never fire early, so the elapsed
       check is a floor rather than a flaky race. */
    await waitFor(
      () =>
        expect(screen.getByText("Mods are installed and ready.")).toBeTruthy(),
      { timeout: 3000 }
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    expect(spinner()).toBeNull();
  });

  /* Selecting the tab re-reads the same state, and that one must not blank the
     card — a flicker on every visit is not feedback. */
  it("does not blank the card on the tab's own refresh", async () => {
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Mods are installed and ready.")).toBeTruthy()
    );
    expect(spinner()).toBeNull();
  });
});

describe("mod status", () => {
  it("reports a complete install", async () => {
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Mods are installed and ready.")).toBeTruthy()
    );
    expect(screen.getByText("INSTALLED")).toBeTruthy();
  });

  it("distinguishes a partial install from no install at all", async () => {
    commands.verifyInstall.mockResolvedValue([
      { name: "Elefrac.dll", present: true },
      { name: "Injector.dll", present: false },
    ]);
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Some mod files are missing.")).toBeTruthy()
    );
    expect(screen.getByText("MISSING")).toBeTruthy();
    expect(screen.getByText(/1 of 2 file missing/)).toBeTruthy();
  });

  it("says mods are absent when nothing is present", async () => {
    commands.verifyInstall.mockResolvedValue([
      { name: "Elefrac.dll", present: false },
      { name: "Injector.dll", present: false },
    ]);
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Mods are not installed.")).toBeTruthy()
    );
  });

  it("asks for a game folder first when none is set", async () => {
    commands.getStatus.mockResolvedValue(
      makeStatus({ game_path: "", exe_present: false })
    );
    renderMods();
    await waitFor(() =>
      expect(screen.getByText(/Set the game folder first/)).toBeTruthy()
    );
    expect(screen.queryByText("INSTALLED")).toBeNull();
  });
});

/* The catalogue is exercised in full by ui/i18n; what matters here is that
   both cards read from it — every string on this view used to be a literal. */
describe("language", () => {
  const renderTranslated = () =>
    render(
      <LocaleGate>
        <ModsView />
      </LocaleGate>,
      { wrapper: Providers }
    );

  it("draws both cards in the saved language", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "fr" }));
    renderTranslated();

    expect(
      await screen.findByText("Les mods sont installés et prêts.")
    ).toBeTruthy();
    expect(screen.getByText("Localiser l'installation")).toBeTruthy();
    expect(screen.getByText("INSTALLÉS")).toBeTruthy();
    expect(screen.queryByText("Locate install")).toBeNull();
  });

  /* "1 of 2 file(s) missing" was the old English hedge. French agrees the
     noun and the adjective with the count, which a hedge can't do. */
  it("agrees the missing-files count with the language's own plural rules", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ language: "fr" }));
    commands.verifyInstall.mockResolvedValue([
      { name: "Elefrac.dll", present: false },
      { name: "Injector.dll", present: false },
      { name: "Loader.dll", present: true },
    ]);
    renderTranslated();

    expect(await screen.findByText(/2 fichiers manquants sur 3/)).toBeTruthy();
  });
});

describe("game panel", () => {
  it("shows the configured folder in the editable box", async () => {
    renderMods();
    await waitFor(() =>
      expect(screen.getByDisplayValue("/games/spellbreak")).toBeTruthy()
    );
    // The line under it used to repeat the path; now it only speaks up when
    // there is nothing set, or a download has something to say.
    expect(screen.queryByText(/Game folder:/)).toBeNull();
  });

  it("prompts to locate or download when no folder is set", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ game_path: "" }));
    renderMods();
    await waitFor(() =>
      expect(screen.getByText(/No game folder set/)).toBeTruthy()
    );
  });

  it("offers both entry points", async () => {
    renderMods();
    await waitFor(() =>
      expect(screen.getByText("Locate install")).toBeTruthy()
    );
    expect(screen.getByText("Download game…")).toBeTruthy();
  });
});
