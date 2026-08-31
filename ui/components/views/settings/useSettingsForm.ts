import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { isWindows } from "@/lib/platform";
import type { Settings } from "@/lib/rust";
import { toastError } from "@/i18n/errors";
import { computeWrapperState, type WrapperState } from "./wrapper";

/** The text fields, named by the settings key each one writes. */
export type TextKey = "wine_prefix" | "cdn_base" | "auth_url" | "players_url";

/* Changing one of these points the app somewhere new, so whatever reads it is
   re-pulled afterwards. The window toggles change nothing outside the window,
   and re-reading the install on every flick of a switch would be waste. */
const REPOINTS: string[] = [
  "wine_prefix",
  "cdn_base",
  "auth_url",
  "players_url",
  "launch_command",
];

/** Every field in Settings. There is no Save: each one writes as you leave it. */
export interface SettingsForm {
  /** Switches, written the moment they are flicked. */
  minimizeOnClose: boolean;
  setMinimizeOnClose: (v: boolean) => void;
  closeOnLaunch: boolean;
  setCloseOnLaunch: (v: boolean) => void;

  /* Text is a draft while you type, `commitText` save it. */
  winePrefix: string;
  setWinePrefix: (v: string) => void;
  cdnBase: string;
  setCdnBase: (v: string) => void;
  authUrl: string;
  setAuthUrl: (v: string) => void;
  playersUrl: string;
  setPlayersUrl: (v: string) => void;
  /** Write one text field now: on blur, or after a picker has filled it in.
   *  Takes the value rather than reading it back, so a caller that has just
   *  set it doesn't race its own state update. */
  commitText: (key: TextKey, value: string) => void;

  /* The wrapper picker writes at once; its free-text half is a draft like any
     other, so `commitWrapper` takes the state to write for the same reason. */
  wrapper: WrapperState;
  setWrapper: (w: WrapperState) => void;
  commitWrapper: (w: WrapperState) => void;
}

/**
 * Holds the Settings form. The fields live here rather than in the cards that
 * draw them because they share one writer — every change is saved on the spot,
 * so there is no Save button to gather them for. game_path is not among them:
 * it is written from Game & Mods, the card that also acts on it.
 */
export function useSettingsForm(): SettingsForm {
  const { settings, wrappers, saveSettings } = useSettings();
  const { refreshStatus } = useGame();
  const { refreshPlayers } = useLiveData();

  const [minimizeOnClose, setMinimizeOnCloseState] = useState(false);
  const [closeOnLaunch, setCloseOnLaunchState] = useState(false);
  const [winePrefix, setWinePrefix] = useState("");
  const [cdnBase, setCdnBase] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [playersUrl, setPlayersUrl] = useState("");
  const [wrapper, setWrapper] = useState<WrapperState>({
    mode: "select",
    value: "",
  });

  /* The newest settings we have seen or written. Context's copy only catches
     up once a save resolves and a render lands, so two changes in quick
     succession would otherwise both spread the same stale base and the first
     would be silently undone. */
  const latest = useRef<Settings | null>(null);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);

  /** Merge a patch into the current settings and write it. */
  const persist = async (patch: Partial<Settings>) => {
    const base = latest.current ?? settings;
    if (!base) {
      return;
    }
    const next = { ...base, ...patch };
    latest.current = next;
    try {
      await saveSettings(next);
    } catch (e) {
      // Put the ref back, or every later write builds on a value that isn't
      // on disk.
      latest.current = settings;
      toastError(e);
      return;
    }
    if (Object.keys(patch).some((key) => REPOINTS.includes(key))) {
      await refreshStatus();
      refreshPlayers();
    }
  };

  // Mirror the backend-loaded settings into the form fields whenever the
  // persisted values change (initial load, our own write, reset, or a folder
  // picked from Home). Keyed on the values rather than the settings object so
  // that something touching an unrelated field — signing in, say — doesn't
  // throw away an edit in progress here.
  const srcWinePrefix = settings?.wine_prefix ?? "";
  const srcCdnBase = settings?.cdn_base ?? "";
  const srcAuthUrl = settings?.auth_url ?? "";
  const srcPlayersUrl = settings?.players_url ?? "";
  const srcLaunchCommand = settings?.launch_command ?? "";
  const srcMinimizeOnClose = settings?.minimize_on_close ?? false;
  const srcCloseOnLaunch = settings?.close_on_launch ?? false;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setWinePrefix(srcWinePrefix);
    setCdnBase(srcCdnBase);
    setAuthUrl(srcAuthUrl);
    setPlayersUrl(srcPlayersUrl);
  }, [srcWinePrefix, srcCdnBase, srcAuthUrl, srcPlayersUrl]);

  useEffect(() => {
    setMinimizeOnCloseState(srcMinimizeOnClose);
    setCloseOnLaunchState(srcCloseOnLaunch);
  }, [srcMinimizeOnClose, srcCloseOnLaunch]);

  // Separate pass: the detected wrapper list arrives after settings do, and
  // the saved command can only be classified as known-vs-custom once it's in.
  useEffect(() => {
    setWrapper(computeWrapperState(srcLaunchCommand, wrappers));
  }, [srcLaunchCommand, wrappers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** The command a wrapper state resolves to, as it goes to disk. */
  const commandFor = (w: WrapperState) => {
    if (isWindows) {
      return latest.current?.launch_command ?? settings?.launch_command ?? "";
    }
    if (!wrappers.length) {
      return w.value.trim();
    }
    return w.mode === "custom" ? w.value.trim() : w.value;
  };

  const setMinimizeOnClose = (v: boolean) => {
    setMinimizeOnCloseState(v);
    persist({ minimize_on_close: v });
  };

  const setCloseOnLaunch = (v: boolean) => {
    setCloseOnLaunchState(v);
    persist({ close_on_launch: v });
  };

  const commitText = (key: TextKey, value: string) => {
    const trimmed = value.trim();
    // Leaving a field you didn't change shouldn't cost a write.
    if ((latest.current ?? settings)?.[key] === trimmed) {
      return;
    }
    persist({ [key]: trimmed });
  };

  const commitWrapper = (w: WrapperState) => {
    const command = commandFor(w);
    if ((latest.current ?? settings)?.launch_command === command) {
      return;
    }
    persist({ launch_command: command });
  };

  return {
    minimizeOnClose,
    setMinimizeOnClose,
    closeOnLaunch,
    setCloseOnLaunch,
    winePrefix,
    setWinePrefix,
    cdnBase,
    setCdnBase,
    authUrl,
    setAuthUrl,
    playersUrl,
    setPlayersUrl,
    commitText,
    wrapper,
    setWrapper,
    commitWrapper,
  };
}
