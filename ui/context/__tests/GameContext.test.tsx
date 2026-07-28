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
  useToastState: () => null,
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
    // A launcher that is itself out of date shouldn't start patching the game
    // first: the update prompt has to come up before that work begins.
    const check = deferred<{ current: string; remote: string; update: boolean }>();
    commands.getLauncherUpdate.mockReturnValue(check.promise);
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));

    renderGame();
    await Promise.resolve();
    expect(commands.getStatus).not.toHaveBeenCalled();
    expect(commands.updatePatch).not.toHaveBeenCalled();

    await act(async () => {
      check.resolve({ current: "3.0.2", remote: "3.1.0", update: true });
      await check.promise;
    });
    await waitFor(() => expect(commands.updatePatch).toHaveBeenCalled());
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

describe("startup update check", () => {
  it("applies a pending patch when the install is behind the CDN", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));
    renderGame();
    await waitFor(() => expect(commands.updatePatch).toHaveBeenCalled());
  });

  it("still applies it when get_status resolves after get_versions", async () => {
    // autoUpdate reads the status through a ref. Firing it before the first
    // refreshStatus lands makes it see null and skip the update silently, so
    // the startup sequence has to order the two.
    const status = deferred<ReturnType<typeof makeStatus>>();
    commands.getStatus.mockReturnValue(status.promise);
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));

    renderGame();
    await Promise.resolve();
    expect(commands.updatePatch).not.toHaveBeenCalled();

    await act(async () => {
      status.resolve(makeStatus());
      await status.promise;
    });
    await waitFor(() => expect(commands.updatePatch).toHaveBeenCalled());
  });

  it("does nothing when the install already matches the CDN", async () => {
    renderGame();
    await waitFor(() => expect(commands.getVersions).toHaveBeenCalled());
    expect(commands.updatePatch).not.toHaveBeenCalled();
  });

  it("does nothing when the game is not installed", async () => {
    commands.getStatus.mockResolvedValue(makeStatus({ exe_present: false }));
    commands.getVersions.mockResolvedValue(makeVersions({ local: null, remote: "6.0.3" }));
    renderGame();
    await waitFor(() => expect(commands.getVersions).toHaveBeenCalled());
    expect(commands.updatePatch).not.toHaveBeenCalled();
  });

  it("does nothing when the CDN version is unavailable", async () => {
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: null }));
    renderGame();
    await waitFor(() => expect(commands.getVersions).toHaveBeenCalled());
    expect(commands.updatePatch).not.toHaveBeenCalled();
  });
});

describe("updating flag", () => {
  it("is raised for the duration of the patch so Launch can be disabled", async () => {
    const patch = deferred<{ status: "ok"; data: string }>();
    commands.updatePatch.mockReturnValue(patch.promise);
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));

    const { result } = renderGame();
    await waitFor(() => expect(result.current.updating).toBe(true));

    await act(async () => {
      patch.resolve({ status: "ok", data: "6.0.3" });
      await patch.promise;
    });
    await waitFor(() => expect(result.current.updating).toBe(false));
  });

  it("is lowered again when the patch fails", async () => {
    commands.updatePatch.mockResolvedValue({ status: "error", error: "connection reset" });
    commands.getVersions.mockResolvedValue(makeVersions({ local: "6.0.2", remote: "6.0.3" }));

    const { result } = renderGame();
    await waitFor(() => expect(commands.updatePatch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.updating).toBe(false));
  });
});

describe("launcher self-update", () => {
  it("opens the install dialog when the backend flags an update", async () => {
    commands.getLauncherUpdate.mockResolvedValue({
      current: "3.0.2",
      remote: "3.1.0",
      update: true,
    });
    const { result } = renderGame();
    await waitFor(() => expect(result.current.showUpdateModal).toBe(true));
  });

  it("stays quiet when the backend says the update was already taken", async () => {
    commands.getLauncherUpdate.mockResolvedValue({
      current: "3.0.2",
      remote: "3.1.0",
      update: false,
    });
    const { result } = renderGame();
    await waitFor(() => expect(result.current.launcherInfo).not.toBeNull());
    expect(result.current.showUpdateModal).toBe(false);
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
