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
import { updateTarget, versionsBehind, versionsKnown } from "@/lib/versions";
import { toast } from "@/lib/toast";
import { errorText } from "@/i18n/errors";
import { _ } from "@/i18n";
import { vetGameFolder } from "@/lib/gameFolder";
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
  /** Top-right "Launcher Update Available" popup. */
  launcherUpdatePop: boolean;
  setLauncherUpdatePop: (v: boolean) => void;
  gameOutdated: boolean;
  refreshStatus: () => Promise<GameStatus | null>;
  refreshVersions: () => Promise<VersionInfo | null>;
  checkLauncherUpdate: () => Promise<LauncherUpdateInfo | null>;
  /** Ask the CDN, right now, whether the install is behind it, refreshing the
      versions every view reads on the way. Three answers, so the caller can
      tell an unreachable CDN (`remote: null`) from an install that is current.
      The automatic path is `gameOutdated`; this is the manual check. */
  checkGameUpdate: () => Promise<{ remote: string | null; outdated: boolean }>;
  /** Pull the pending game patch. Driven by Home's Launch/Update plate. */
  applyGameUpdate: () => Promise<boolean>;
  provisionInstall: (
    report?: (msg: string, isError?: boolean) => void
  ) => Promise<boolean>;
  locateGame: () => Promise<void>;
  downloadGame: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

/* A launcher left open never learned of a release until it was restarted, and
   one too old for the CDN's current downloads just failed with 403s. It asks
   again on this beat, on focus, and after a failed download; the update then
   applies itself (LauncherUpdatePop). */
const LAUNCHER_UPDATE_HEARTBEAT_MS = 5 * 60_000;
const LAUNCHER_UPDATE_MIN_GAP_MS = 60_000;

export function GameProvider({ children }: { children: ReactNode }) {
  const { settings, saveSettings, refreshSettings } = useSettings();

  const [status, setStatus] = useState<GameStatus | null>(null);
  const [versions, setVersions] = useState<VersionInfo | null>(null);
  const [launcherInfo, setLauncherInfo] = useState<LauncherUpdateInfo | null>(
    null
  );
  const [updating, setUpdating] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [launcherUpdatePop, setLauncherUpdatePop] = useState(false);

  // Latest-value ref so checkGameUpdate can read the status without depending
  // on it. Written synchronously alongside setStatus rather than from an
  // effect, so a caller awaiting refreshStatus sees it immediately.
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
      return v;
    } catch {
      setVersions(null);
      return null;
    }
  }, []);

  const lastLauncherCheck = useRef(0);
  const checkLauncherUpdate = useCallback(async () => {
    lastLauncherCheck.current = Date.now();
    try {
      const info = await rust.getLauncherUpdate();
      setLauncherInfo(info);
      if (info?.update) {
        setLauncherUpdatePop(true);
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
      /* A folder the launcher can't keep current (a Steam or Epic copy, one
         in OneDrive, one it can't write to) would read "up to date" here
         while the game kept running the old files. */
      // Read fresh: a Locate saves the path just before calling this.
      const path = (await rust.getSettings()).game_path ?? "";
      if (path.trim()) {
        const problem = await vetGameFolder(path);
        if (problem !== null) {
          if (problem) {
            report(problem, true);
            setInstallNotice(problem);
          }
          return false;
        }
      }
      try {
        const v = await rust.getVersions();
        /* Only an answer from the CDN can say an install is current; an
           unreachable one leaves both tracks unknown, and that provisions. */
        if (versionsKnown(v) && !versionsBehind(v)) {
          report(
            _("game.alreadyCurrent", {
              version: v?.local_game ?? v?.local ?? "",
            })
          );
          return true;
        }
      } catch {
        /* fall through to install */
      }
      report(_("game.provisioning"));
      try {
        const ver = await rust.updatePatch();
        report(
          ver && ver !== "unknown"
            ? _("game.provisioned", { version: ver })
            : _("game.provisionedUnknown")
        );
        return true;
      } catch (e) {
        report(_("game.provisionFailed", { detail: errorText(e) }), true);
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
        dir = await rust.pickGameDir(_("game.pickFolder"));
      }
      if (!dir || !settings) {
        return;
      }
      const problem = await vetGameFolder(dir);
      if (problem !== null) {
        if (problem) {
          toast(problem, true);
          setInstallNotice(problem);
        }
        return;
      }
      setInstallNotice(null);
      await saveSettings({ ...settings, game_path: dir });
      toast(_("game.folderSet", { path: dir }));
      await refreshStatus();
      await provisionInstall();
    } finally {
      setInstallBusy(false);
    }
  }, [settings, saveSettings, refreshStatus, provisionInstall]);

  const downloadGame = useCallback(async () => {
    const dest = await rust.pickGameDir(
      _("game.pickDestination"),
      await rust.suggestedInstallDir()
    );
    if (!dest) {
      return;
    }
    const problem = await vetGameFolder(dest);
    if (problem !== null) {
      if (problem) {
        toast(problem, true);
        setInstallNotice(problem);
      }
      return;
    }
    setInstallBusy(true);
    setInstallNotice(_("game.downloading"));
    try {
      const root = await rust.downloadGame(dest);
      toast(_("game.downloaded", { path: root }));
      setInstallNotice(null);
      // download_game writes game_path itself, so re-read or the settings the
      // UI holds stay stale and get saved back over the new install.
      await refreshSettings();
    } catch (e) {
      const why = errorText(e);
      toast(why, true);
      setInstallNotice(_("game.downloadFailed", { detail: why }));
      // A launcher the CDN has moved past fails here first.
      void checkLauncherUpdate();
    } finally {
      setInstallBusy(false);
      refreshStatus();
    }
  }, [refreshSettings, refreshStatus, checkLauncherUpdate]);

  const checkGameUpdate = useCallback(async () => {
    const v = await refreshVersions();
    const st = statusRef.current;
    /* Playtest rounds are published on their own keys and installed from the
       Playtest pill, so this plate never asks a tester to update. */
    const isPlaytest = st?.variant === "playtest";
    return {
      remote: updateTarget(v),
      outdated: Boolean(st?.exe_present && !isPlaytest && versionsBehind(v)),
    };
  }, [refreshVersions]);

  const applyGameUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      const version = await rust.updatePatch();
      toast(
        version && version !== "unknown"
          ? _("game.updated", { version })
          : _("game.updatedUnknown")
      );
      return true;
    } catch (e) {
      toast(_("game.updateFailed", { detail: errorText(e) }), true);
      void checkLauncherUpdate();
      return false;
    } finally {
      setUpdating(false);
      refreshStatus();
      refreshVersions();
    }
  }, [refreshStatus, refreshVersions, checkLauncherUpdate]);

  // One-time startup sequence — deliberately runs only on mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Update-first: the launcher's own update check goes ahead of the game
    // one, so a newer build prompts before a stale one offers a patch.
    checkLauncherUpdate().then(() => {
      refreshStatus();
      refreshVersions();
    });
    const statusId = setInterval(refreshStatus, 15_000);
    const updateId = setInterval(
      checkLauncherUpdate,
      LAUNCHER_UPDATE_HEARTBEAT_MS
    );
    const onFocus = () => {
      refreshVersions();
      if (
        Date.now() - lastLauncherCheck.current >=
        LAUNCHER_UPDATE_MIN_GAP_MS
      ) {
        void checkLauncherUpdate();
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(statusId);
      clearInterval(updateId);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isPlaytest = status?.variant === "playtest";
  const gameOutdated = Boolean(
    status?.exe_present && !isPlaytest && versionsBehind(versions)
  );

  const value: GameContextValue = {
    status,
    versions,
    launcherInfo,
    updating,
    installBusy,
    installNotice,
    launcherUpdatePop,
    setLauncherUpdatePop,
    gameOutdated,
    refreshStatus,
    refreshVersions,
    checkLauncherUpdate,
    checkGameUpdate,
    applyGameUpdate,
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
