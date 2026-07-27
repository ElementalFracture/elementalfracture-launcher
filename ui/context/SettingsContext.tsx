import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as rust from "@/lib/rust";
import type { Settings, TokenResult, WrapperOption } from "@/lib/rust";
import { isWindows } from "@/lib/platform";

interface SettingsContextValue {
  settings: Settings | null;
  wrappers: WrapperOption[];
  refreshSettings: () => Promise<Settings | null>;
  saveSettings: (next: Settings) => Promise<void>;
  resetSettings: () => Promise<Settings>;
  applyToken: (token: string) => Promise<TokenResult>;
  loadWrappers: () => Promise<WrapperOption[]>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [wrappers, setWrappers] = useState<WrapperOption[]>([]);

  const loadWrappers = useCallback(async () => {
    try {
      const w = await rust.detectWrappers();
      setWrappers(w);
      return w;
    } catch {
      setWrappers([]);
      return [];
    }
  }, []);

  /* Re-read what the backend has on disk. Needed after any command that
     writes settings itself (download_game sets game_path), or the form here
     would keep — and re-save — the stale value. */
  const refreshSettings = useCallback(async () => {
    try {
      const s = await rust.getSettings();
      setSettings(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  const saveSettings = useCallback(async (next: Settings) => {
    await rust.saveSettings(next);
    setSettings(next);
  }, []);

  const resetSettings = useCallback(async () => {
    const s = await rust.resetSettings();
    setSettings(s);
    return s;
  }, []);

  const applyToken = useCallback(async (token: string) => {
    const res = await rust.applyToken(token);
    const fresh = await rust.getSettings();
    setSettings(fresh);
    return res;
  }, []);

  useEffect(() => {
    (async () => {
      const initial = await rust.getSettings();
      setSettings(initial);
      if (!isWindows) {
        loadWrappers();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: SettingsContextValue = {
    settings,
    wrappers,
    refreshSettings,
    saveSettings,
    resetSettings,
    applyToken,
    loadWrappers,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return ctx;
}
