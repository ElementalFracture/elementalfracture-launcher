import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { GameProvider, useGame } from "../GameContext";
import { SettingsProvider } from "../SettingsContext";
import { deferred, makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

// hoisted so the vi.mock factory below — which vitest lifts to the top of the
// file — can close over it.
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
  autoFindGame: vi.fn(),
  pickGameDir: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));
vi.mock("@/lib/toast", () => ({
  toast: vi.fn(),
  toastOnce: vi.fn(),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameProvider>{children}</GameProvider>
  </SettingsProvider>
);

const renderGame = () => renderHook(() => useGame(), { wrapper });

beforeEach(() => {
  commands.getSettings.mockResolvedValue(makeSettings());
  commands.detectWrappers.mockResolvedValue([]);
  commands.getStatus.mockResolvedValue(makeStatus());
  commands.getVersions.mockResolvedValue(makeVersions());
  commands.getLauncherUpdate.mockResolvedValue({ current: "3.0.2", remote: null, update: false });
  commands.updatePatch.mockResolvedValue({ status: "ok", data: "6.0.3" });
});

describe("update-first startup", () => {
  it("holds the game work until the launcher update check has answered", async () => {
    // A launcher that is itself out of date shouldn't offer a game update
    // first: its own prompt has to come up before that work begins.
    const check = deferred<{ current: string; remote: string; update: boolean }>();
    commands.getLauncherUpdate.mockReturnValue(check.promise);
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));

    const { result } = renderGame();
    await Promise.resolve();
    expect(commands.getStatus).not.toHaveBeenCalled();
    expect(result.current.gameOutdated).toBe(false);

    await act(async () => {
      check.resolve({ current: "3.0.2", remote: "3.1.0", update: true });
      await check.promise;
    });
    await waitFor(() => expect(result.current.gameOutdated).toBe(true));
  });

  it("still runs the game work when the launcher check fails", async () => {
    // Offline, get_launcher_update rejects — the rest of startup has to carry
    // on regardless or the launcher comes up with no status at all.
    commands.getLauncherUpdate.mockRejectedValue(new Error("offline"));
    renderGame();
    await waitFor(() => expect(commands.getStatus).toHaveBeenCalled());
    expect(commands.getVersions).toHaveBeenCalled();
  });
});

describe("gameOutdated", () => {
  it("goes up when the install is behind the CDN", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    const { result } = renderGame();
    await waitFor(() => expect(result.current.gameOutdated).toBe(true));
  });

  it("never patches on its own — the plate has to be clicked", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    const { result } = renderGame();
    await waitFor(() => expect(result.current.gameOutdated).toBe(true));
    expect(commands.updatePatch).not.toHaveBeenCalled();
  });

  it("holds until the status says the game is actually installed", async () => {
    // Derived from both, so whichever lands second is what raises it — a
    // version answer on its own says nothing about an install that isn't there.
    const status = deferred<ReturnType<typeof makeStatus>>();
    commands.getStatus.mockReturnValue(status.promise);
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));

    const { result } = renderGame();
    await Promise.resolve();
    expect(result.current.gameOutdated).toBe(false);

    await act(async () => {
      status.resolve(makeStatus());
      await status.promise;
    });
    await waitFor(() => expect(result.current.gameOutdated).toBe(true));
  });

  it("stays down when the install already matches the CDN", async () => {
    const { result } = renderGame();
    await waitFor(() => expect(commands.getVersions).toHaveBeenCalled());
    expect(result.current.gameOutdated).toBe(false);
  });

  it("stays down when the game is not installed", async () => {
    commands.getStatus.mockResolvedValue(makeStatus({ exe_present: false }));
    commands.getVersions.mockResolvedValue(makeVersions({ local: null, remote: "6.0.3" }));
    const { result } = renderGame();
    await waitFor(() => expect(commands.getVersions).toHaveBeenCalled());
    expect(result.current.gameOutdated).toBe(false);
  });

  it("stays down when the CDN version is unavailable — nobody is locked out offline", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: null }));
    const { result } = renderGame();
    await waitFor(() => expect(commands.getVersions).toHaveBeenCalled());
    expect(result.current.gameOutdated).toBe(false);
  });
});

describe("noticing an update without being asked", () => {
  it("re-reads the versions when the window comes back", async () => {
    // One of the two moments the CDN is asked at all — there is no timer, so
    // coming back from the patch notes is what turns Launch into Update. The
    // other is the launch itself (see the Home suite).
    const { result } = renderGame();
    await waitFor(() => expect(result.current.versions).not.toBeNull());
    expect(result.current.gameOutdated).toBe(false);

    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(result.current.gameOutdated).toBe(true));
  });
});

describe("applyGameUpdate", () => {
  it("raises the updating flag for the duration so Launch can be disabled", async () => {
    const patch = deferred<{ status: "ok"; data: string }>();
    commands.updatePatch.mockReturnValue(patch.promise);

    const { result } = renderGame();
    await waitFor(() => expect(result.current.status).not.toBeNull());

    let done: Promise<boolean>;
    act(() => {
      done = result.current.applyGameUpdate();
    });
    await waitFor(() => expect(result.current.updating).toBe(true));

    await act(async () => {
      patch.resolve({ status: "ok", data: "6.0.3" });
      await done;
    });
    await waitFor(() => expect(result.current.updating).toBe(false));
  });

  it("stops offering once the patch lands", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    // The patch is what makes the install current, so the versions read
    // afterwards agree — which is what lowers the flag.
    commands.updatePatch.mockImplementation(async () => {
      commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.3", remote: "6.0.3" }));
      return { status: "ok", data: "6.0.3" };
    });

    const { result } = renderGame();
    await waitFor(() => expect(result.current.gameOutdated).toBe(true));

    await act(async () => {
      await result.current.applyGameUpdate();
    });
    expect(commands.updatePatch).toHaveBeenCalled();
    await waitFor(() => expect(result.current.gameOutdated).toBe(false));
  });

  it("keeps offering it and lowers the flag when the patch fails", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    commands.updatePatch.mockResolvedValue({ status: "error", error: "connection reset" });

    const { result } = renderGame();
    await waitFor(() => expect(result.current.gameOutdated).toBe(true));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.applyGameUpdate();
    });
    expect(ok).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.gameOutdated).toBe(true);
  });
});

describe("launcher self-update", () => {
  it("raises the corner popup when the backend flags an update", async () => {
    commands.getLauncherUpdate.mockResolvedValue({
      current: "3.0.2",
      remote: "3.1.0",
      update: true,
    });
    const { result } = renderGame();
    await waitFor(() => expect(result.current.launcherUpdatePop).toBe(true));
  });

  it("stays quiet when the backend says the update was already taken", async () => {
    commands.getLauncherUpdate.mockResolvedValue({
      current: "3.0.2",
      remote: "3.1.0",
      update: false,
    });
    const { result } = renderGame();
    await waitFor(() => expect(result.current.launcherInfo).not.toBeNull());
    expect(result.current.launcherUpdatePop).toBe(false);
  });
});

describe("provisionInstall", () => {
  it("skips the patch when the install already matches the CDN", async () => {
    const { result } = renderGame();
    await waitFor(() => expect(result.current.status).not.toBeNull());
    commands.updatePatch.mockClear();

    const report = vi.fn();
    await act(async () => {
      await result.current.provisionInstall(report);
    });
    expect(commands.updatePatch).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith("Already up to date (v6.0.2)");
  });

  it("patches when the versions disagree", async () => {
    const { result } = renderGame();
    await waitFor(() => expect(result.current.status).not.toBeNull());
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.1", remote: "6.0.3" }));
    commands.updatePatch.mockClear();

    const report = vi.fn();
    await act(async () => {
      await result.current.provisionInstall(report);
    });
    expect(commands.updatePatch).toHaveBeenCalled();
    expect(report).toHaveBeenLastCalledWith("Install ready (v6.0.3)");
  });

  it("reports a failure instead of claiming the install is ready", async () => {
    const { result } = renderGame();
    await waitFor(() => expect(result.current.status).not.toBeNull());
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.1", remote: "6.0.3" }));
    commands.updatePatch.mockResolvedValue({ status: "error", error: "disk full" });

    const report = vi.fn();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.provisionInstall(report);
    });
    expect(ok).toBe(false);
    expect(report).toHaveBeenLastCalledWith(expect.stringContaining("disk full"), true);
  });
});

describe("status refresh", () => {
  it("survives a backend that throws, leaving the last good status in place", async () => {
    const { result } = renderGame();
    await waitFor(() => expect(result.current.status).not.toBeNull());

    commands.getStatus.mockRejectedValue(new Error("ipc closed"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    let returned: unknown;
    await act(async () => {
      returned = await result.current.refreshStatus();
    });
    expect(returned).toBeNull();
    expect(result.current.status).not.toBeNull();
  });
});
