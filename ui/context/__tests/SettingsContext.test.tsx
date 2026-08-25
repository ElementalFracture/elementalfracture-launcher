import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SettingsProvider, useSettings } from "../SettingsContext";
import { makeSettings } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  resetSettings: vi.fn(),
  applyToken: vi.fn(),
  refreshAccount: vi.fn(),
  detectWrappers: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

const renderSettings = () => renderHook(() => useSettings(), { wrapper });

beforeEach(() => {
  commands.getSettings.mockResolvedValue(makeSettings());
  commands.detectWrappers.mockResolvedValue([{ command: "umu-run", label: "umu-run" }]);
  commands.saveSettings.mockResolvedValue({ status: "ok", data: null });
  commands.refreshAccount.mockResolvedValue({ status: "ok", data: null });
});

describe("refreshAccount", () => {
  it("picks up a badge granted while the launcher was open", async () => {
    // What makes the Test Build channel appear without a restart.
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.settings?.is_tester).toBe(false);

    commands.refreshAccount.mockResolvedValue({
      status: "ok",
      data: { username: "Lytion", is_staff: false, is_dev: false, is_tester: true },
    });
    commands.getSettings.mockResolvedValue(makeSettings({ is_tester: true }));

    await act(async () => {
      await result.current.refreshAccount();
    });
    expect(result.current.settings?.is_tester).toBe(true);
  });

  it("leaves the roles alone when the portal says nothing", async () => {
    // A network blip answers null. Re-reading settings on that would be
    // harmless here but pointless — the badge must never be lost to a blip.
    commands.getSettings.mockResolvedValue(makeSettings({ is_tester: true }));
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings?.is_tester).toBe(true));

    commands.getSettings.mockClear();
    await act(async () => {
      await result.current.refreshAccount();
    });
    expect(commands.getSettings).not.toHaveBeenCalled();
    expect(result.current.settings?.is_tester).toBe(true);
  });

  it("survives a refresh that throws", async () => {
    commands.refreshAccount.mockRejectedValue(new Error("offline"));
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());

    await act(async () => {
      await result.current.refreshAccount();
    });
    expect(result.current.settings).not.toBeNull();
  });
});

describe("initial load", () => {
  it("exposes what the backend has and the detected wrappers", async () => {
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.settings?.game_path).toBe("/games/spellbreak");
    await waitFor(() => expect(result.current.wrappers).toHaveLength(1));
  });

  it("treats a failed wrapper probe as none detected rather than crashing", async () => {
    commands.detectWrappers.mockRejectedValue(new Error("no such command"));
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    expect(result.current.wrappers).toEqual([]);
  });
});

describe("refreshSettings", () => {
  it("picks up a game_path the backend wrote on its own", async () => {
    // download_game sets game_path itself; without this re-read the Settings
    // form would keep the old value and save it back over the new install.
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());

    commands.getSettings.mockResolvedValue(makeSettings({ game_path: "/mnt/games/spellbreak" }));
    await act(async () => {
      await result.current.refreshSettings();
    });
    expect(result.current.settings?.game_path).toBe("/mnt/games/spellbreak");
  });

  it("keeps the last good settings when the re-read fails", async () => {
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());

    commands.getSettings.mockRejectedValue(new Error("ipc closed"));
    let returned: unknown;
    await act(async () => {
      returned = await result.current.refreshSettings();
    });
    expect(returned).toBeNull();
    expect(result.current.settings?.game_path).toBe("/games/spellbreak");
  });
});

describe("saveSettings", () => {
  it("holds the saved object as the new state", async () => {
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());

    const next = makeSettings({ cdn_base: "https://cdn.example.test" });
    await act(async () => {
      await result.current.saveSettings(next);
    });
    expect(commands.saveSettings).toHaveBeenCalledWith(next);
    expect(result.current.settings?.cdn_base).toBe("https://cdn.example.test");
  });

  it("throws and leaves state alone when the backend rejects the save", async () => {
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());

    commands.saveSettings.mockResolvedValue({ status: "error", error: "path is not writable" });
    await expect(
      act(async () => {
        await result.current.saveSettings(makeSettings({ game_path: "/read-only" }));
      })
    ).rejects.toThrow("path is not writable");
    expect(result.current.settings?.game_path).toBe("/games/spellbreak");
  });
});

describe("applyToken", () => {
  it("re-reads settings so the username the portal resolved shows up", async () => {
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());

    commands.applyToken.mockResolvedValue({
      status: "ok",
      data: { username: "Breaker", is_staff: true, is_dev: false, verified: true, warning: null },
    });
    commands.getSettings.mockResolvedValue(makeSettings({ username: "Breaker", is_staff: true }));

    await act(async () => {
      await result.current.applyToken("tok-123");
    });
    expect(commands.applyToken).toHaveBeenCalledWith("tok-123");
    expect(result.current.settings?.username).toBe("Breaker");
    expect(result.current.settings?.is_staff).toBe(true);
  });
});

describe("resetSettings", () => {
  it("returns the wiped settings and clears onboarded so the wizard re-runs", async () => {
    const { result } = renderSettings();
    await waitFor(() => expect(result.current.settings).not.toBeNull());

    commands.resetSettings.mockResolvedValue({
      status: "ok",
      data: makeSettings({ game_path: "", username: "", onboarded: false }),
    });
    await act(async () => {
      await result.current.resetSettings();
    });
    expect(result.current.settings?.onboarded).toBe(false);
    expect(result.current.settings?.game_path).toBe("");
  });
});
