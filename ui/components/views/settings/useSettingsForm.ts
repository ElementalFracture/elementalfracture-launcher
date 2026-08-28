import { useEffect, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { isWindows } from "@/lib/platform";
import { toast } from "@/lib/toast";
import { computeWrapperState, type WrapperState } from "./wrapper";

/** Every field behind the single Save button, plus the save itself. */
export interface SettingsForm {
  minimizeOnClose: boolean;
  setMinimizeOnClose: (v: boolean) => void;
  closeOnLaunch: boolean;
  setCloseOnLaunch: (v: boolean) => void;
  winePrefix: string;
  setWinePrefix: (v: string) => void;
  cdnBase: string;
  setCdnBase: (v: string) => void;
  authUrl: string;
  setAuthUrl: (v: string) => void;
  playersUrl: string;
  setPlayersUrl: (v: string) => void;
  wrapper: WrapperState;
  setWrapper: (w: WrapperState) => void;
  saving: boolean;
  onSave: () => Promise<void>;
}

/**
 * Holds the Settings form. The fields live here rather than in the cards that
 * draw them because one Save button writes them all at once — game_path is the
 * exception, written on the spot from Game & Mods.
 */
export function useSettingsForm(): SettingsForm {
  const { settings, wrappers, saveSettings } = useSettings();
  const { refreshStatus } = useGame();
  const { refreshPlayers } = useLiveData();

  const [minimizeOnClose, setMinimizeOnClose] = useState(false);
  const [closeOnLaunch, setCloseOnLaunch] = useState(false);
  const [winePrefix, setWinePrefix] = useState("");
  const [cdnBase, setCdnBase] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [playersUrl, setPlayersUrl] = useState("");
  const [wrapper, setWrapper] = useState<WrapperState>({
    mode: "select",
    value: "",
  });
  const [saving, setSaving] = useState(false);

  // Mirror the backend-loaded settings into the form fields whenever the
  // persisted values change (initial load, save, reset, or a folder picked
  // from Home). Keyed on the values rather than the settings object so that
  // something touching an unrelated field — applying a token, say — doesn't
  // throw away edits in progress here.
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
    setMinimizeOnClose(srcMinimizeOnClose);
    setCloseOnLaunch(srcCloseOnLaunch);
  }, [srcMinimizeOnClose, srcCloseOnLaunch]);

  // Separate pass: the detected wrapper list arrives after settings do, and
  // the saved command can only be classified as known-vs-custom once it's in.
  useEffect(() => {
    setWrapper(computeWrapperState(srcLaunchCommand, wrappers));
  }, [srcLaunchCommand, wrappers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedWrapper = () => {
    if (isWindows) {
      return settings?.launch_command ?? "";
    }
    if (!wrappers.length) {
      return wrapper.value.trim();
    }
    return wrapper.mode === "custom" ? wrapper.value.trim() : wrapper.value;
  };

  const onSave = async () => {
    if (!settings) {
      return;
    }
    const next = {
      ...settings,
      minimize_on_close: minimizeOnClose,
      close_on_launch: closeOnLaunch,
      launch_command: selectedWrapper(),
      wine_prefix: winePrefix.trim(),
      cdn_base: cdnBase.trim(),
      auth_url: authUrl.trim(),
      players_url: playersUrl.trim(),
    };
    setSaving(true);
    try {
      await saveSettings(next);
      toast("Settings saved");
      await refreshStatus();
      refreshPlayers();
    } catch (e) {
      toast(String(e), true);
    } finally {
      setSaving(false);
    }
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
    wrapper,
    setWrapper,
    saving,
    onSave,
  };
}
