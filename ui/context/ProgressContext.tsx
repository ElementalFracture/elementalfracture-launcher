import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as rust from "@/lib/rust";
import type { InstallProgress } from "@/lib/rust";

export type { InstallProgress };

// Isolated from the rest of the app state so rapid progress ticks during a
// download only re-render whatever actually reads this (Home's InstallProgress),
// not Mods/Settings which share GameContext but never touch progress.
const ProgressContext = createContext<InstallProgress | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<InstallProgress | null>(null);

  useEffect(() => {
    const unlistenPromise = rust.onInstallProgress((progress) => {
      setProgress(progress);
      if (progress.stage === "done") {
        setTimeout(() => setProgress(null), 2500);
      }
    });
    return () => {
      unlistenPromise.then((un) => un());
    };
  }, []);

  return <ProgressContext.Provider value={progress}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  return useContext(ProgressContext);
}
