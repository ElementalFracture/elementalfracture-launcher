import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as rust from "@/lib/rust";
import type { GameStatus, LauncherUpdateInfo, VersionInfo } from "@/lib/rust";
import { toast, toastOnce } from "@/lib/toast";
import { useSettings } from "@/context/SettingsContext";

interface GameContextValue {
  status: GameStatus | null;
  versions: VersionInfo | null;
  launcherInfo: LauncherUpdateInfo | null;
  /** True while a game patch is being pulled — Launch stays disabled. */
  updating: boolean;
  /** True while locating or downloading — both entry points disable together. */
  installBusy: boolean;
  /** Progress/failure line for the install, shown by Home and Mods alike. */
  installNotice: string | null;
  showUpdateModal: boolean;
  setShowUpdateModal: (v: boolean) => void;
  refreshStatus: () => Promise<GameStatus | null>;
  refreshVersions: () => Promise<VersionInfo | null>;
  checkLauncherUpdate: () => Promise<LauncherUpdateInfo | null>;
  autoUpdate: () => Promise<void>;
  provisionInstall: (report?: (msg: string, isError?: boolean) => void) => Promise<boolean>;
  locateGame: () => Promise<void>;
  downloadGame: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { settings, saveSettings, refreshSettings } = useSettings();

  const [status, setStatus] = useState<GameStatus | null>(null);
  const [versions, setVersions] = useState<VersionInfo | null>(null);
  const [launcherInfo, setLauncherInfo] = useState<LauncherUpdateInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Latest-value ref so autoUpdate can read the status without depending on
  // it. Written synchronously alongside setStatus rather than from an effect,
  // so a caller awaiting refreshStatus sees it immediately.
  const statusRef = useRef<GameStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await rust.getStatus();
      statusRef.current = s;
      setStatus(s);
      return s;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  const refreshVersions = useCallback(async () => {
    try {
      const v = await rust.getVersions();
      setVersions(v);
      const outdated = Boolean(v.local && v.remote && v.local !== v.remote);
      if (outdated) {
        toastOnce(`Update available: v${v.remote}`);
      }
      return v;
    } catch {
      setVersions(null);
      return null;
    }
  }, []);

  const checkLauncherUpdate = useCallback(async () => {
    try {
      const info = await rust.getLauncherUpdate();
      setLauncherInfo(info);
      if (info?.update) {
        setShowUpdateModal(true);
      }
      return info;
    } catch {
      return null;
    }
  }, []);

  /* Bring a freshly-pointed-at install current: balance patch + mods, then
     the version bump. Skipped when the install already matches the CDN
     version — such installs were provisioned by this same pipeline. */
  const provisionInstall = useCallback(
    async (report: (msg: string, isError?: boolean) => void = toast) => {
      try {
        const v = await rust.getVersions();
        if (v?.local && v?.remote && v.local === v.remote) {
          report(`Already up to date (v${v.local})`);
          return true;
        }
      } catch {
        /* fall through to install */
      }
      report("Installing updates & mods…");
      try {
        const ver = await rust.updatePatch();
        report(ver && ver !== "unknown" ? `Install ready (v${ver})` : "Install ready");
        return true;
      } catch (e) {
        report("Couldn't update the install: " + e, true);
        return false;
      } finally {
        refreshStatus();
      }
    },
    [refreshStatus]
  );

  /* Both entry points below are reachable from Home's install block and from
     the Mods & Install "Game" panel, so the busy flag and notice live here
     rather than in either view. */

  const locateGame = useCallback(async () => {
    setInstallBusy(true);
    try {
      let dir = await rust.autoFindGame();
      if (!dir) {
        toast("Nothing found in the usual places, pick the folder yourself.");
        dir = await rust.pickGameDir("Select your Spellbreak folder");
      }
      if (!dir || !settings) {
        return;
      }
      await saveSettings({ ...settings, game_path: dir });
      toast("Game folder set: " + dir);
      await refreshStatus();
      await provisionInstall();
    } finally {
      setInstallBusy(false);
    }
  }, [settings, saveSettings, refreshStatus, provisionInstall]);

  const downloadGame = useCallback(async () => {
    const dest = await rust.pickGameDir("Choose where to install Spellbreak (approx. 25 GB needed)");
    if (!dest) {
      return;
    }
    setInstallBusy(true);
    setInstallNotice("Installing: this is a big download, leave the launcher open.");
    try {
      const root = await rust.downloadGame(dest);
      toast("Game installed to " + root);
      setInstallNotice(null);
      // download_game writes game_path itself, so re-read or the settings the
      // UI holds stay stale and get saved back over the new install.
      await refreshSettings();
    } catch (e) {
      toast(String(e), true);
      setInstallNotice("Install failed: " + e);
    } finally {
      setInstallBusy(false);
      refreshStatus();
    }
  }, [refreshSettings, refreshStatus]);

  /* If the install disagrees with the CDN version, pull the patch. Used both
     by the startup check and by Settings → Check for updates. */
  const autoUpdate = useCallback(async () => {
    let v: VersionInfo | null;
    try {
      v = await rust.getVersions();
    } catch {
      return;
    }
    const st = statusRef.current;
    if (!v?.remote || !st?.exe_present || v.local === v.remote) {
      return;
    }
    toast(`Update available, updating to v${v.remote}…`);
    setUpdating(true);
    try {
      const version = await rust.updatePatch();
      toast(version && version !== "unknown" ? `Game updated to v${version}` : "Game updated");
    } catch (e) {
      toast("Update failed: " + e, true);
    } finally {
      setUpdating(false);
      refreshStatus();
      refreshVersions();
    }
  }, [refreshStatus, refreshVersions]);

  // One-time startup sequence — deliberately runs only on mount. autoUpdate
  // reads the status via statusRef, so it has to wait for the first
  // refreshStatus or it sees null and skips the update entirely.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    refreshStatus().then(autoUpdate);
    checkLauncherUpdate().then(refreshVersions);
    const id = setInterval(refreshStatus, 15_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const value: GameContextValue = {
    status,
    versions,
    launcherInfo,
    updating,
    installBusy,
    installNotice,
    showUpdateModal,
    setShowUpdateModal,
    refreshStatus,
    refreshVersions,
    checkLauncherUpdate,
    autoUpdate,
    provisionInstall,
    locateGame,
    downloadGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}
