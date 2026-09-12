import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSettings } from "@/context/SettingsContext";

export type ViewName = "home" | "mods" | "settings";

interface UIContextValue {
  view: ViewName;
  setView: (v: ViewName) => void;
  showWizard: boolean;
  startWizard: () => void;
  finishWizard: () => Promise<void>;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const { settings, saveSettings } = useSettings();
  const [view, setView] = useState<ViewName>("home");
  const [showWizard, setShowWizard] = useState(false);

  const startWizard = useCallback(() => setShowWizard(true), []);

  const finishWizard = useCallback(async () => {
    if (settings) {
      try {
        await saveSettings({ ...settings, onboarded: true });
      } catch {
        /* still close the wizard even if the save failed */
      }
    }
    setShowWizard(false);
  }, [settings, saveSettings]);

  // Re-open onboarding whenever the loaded settings say it hasn't run yet.
  // First launch, in practice: "Reset settings" leaves onboarded alone.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings && !settings.onboarded) {
      setShowWizard(true);
    }
  }, [settings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const value: UIContextValue = { view, setView, showWizard, startWizard, finishWizard };
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return ctx;
}
