import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdvancedWarnModal } from "@/components/modals/AdvancedWarnModal";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import * as rust from "@/lib/rust";
import { isWindows } from "@/lib/platform";
import { toast } from "@/lib/toast";
import "./SettingsView.css";

const CUSTOM_WRAPPER = "__custom__";

export function computeWrapperState(cur: string, wrappers: { command: string }[]) {
  const trimmed = cur.trim();
  if (trimmed && wrappers.some((w) => w.command === trimmed)) {
    return { mode: "select" as const, value: trimmed };
  }
  if (!trimmed && wrappers.length) {
    return { mode: "select" as const, value: wrappers[0].command };
  }
  return { mode: "custom" as const, value: trimmed };
}

export function SettingsView() {
  const { view, setView } = useUI();
  const { settings, wrappers, saveSettings, resetSettings } = useSettings();
  const {
    versions,
    launcherInfo,
    refreshStatus,
    checkLauncherUpdate,
    refreshVersions,
    autoUpdate,
    provisionInstall,
    setShowUpdateModal,
  } = useGame();
  const { refreshPlayers } = useLiveData();

  const [minimizeOnClose, setMinimizeOnClose] = useState(false);
  const [closeOnLaunch, setCloseOnLaunch] = useState(false);
  const [winePrefix, setWinePrefix] = useState("");
  const [cdnBase, setCdnBase] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const [playersUrl, setPlayersUrl] = useState("");
  const [wrapperMode, setWrapperMode] = useState<"select" | "custom">("select");
  const [wrapperValue, setWrapperValue] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedWarnOpen, setAdvancedWarnOpen] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    const w = computeWrapperState(srcLaunchCommand, wrappers);
    setWrapperMode(w.mode);
    setWrapperValue(w.value);
  }, [srcLaunchCommand, wrappers]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const gameVersionField = versions?.remote
    ? `v${versions.remote}`
    : versions?.local
      ? `v${versions.local} (installed)`
      : "";

  const launcherVersionField = (() => {
    if (launcherInfo?.remote) {
      const cur = launcherInfo.current;
      return (
        `v${launcherInfo.remote}` +
        (cur && cur !== launcherInfo.remote ? ` (installed: v${cur})` : "")
      );
    }
    if (launcherInfo?.current) {
      return `v${launcherInfo.current} (installed)`;
    }
    return "";
  })();

  /* Change the game folder from Settings → Launcher. Saved on the spot rather
     than with the rest of the form: the install work below depends on it. */
  const onBrowseGame = async () => {
    if (!settings) {
      return;
    }
    try {
      const dir = await rust.pickGameDir("Select your Spellbreak folder");
      if (!dir) {
        return;
      }
      await saveSettings({ ...settings, game_path: dir });
      const fresh = await refreshStatus();
      if (fresh?.exe_present) {
        await provisionInstall();
      }
      toast("Game folder updated");
    } catch (e) {
      toast(String(e), true);
    }
  };

  const onBrowsePrefix = async () => {
    const dir = await rust.pickGameDir("Select a Wine prefix folder");
    if (dir) {
      setWinePrefix(dir);
    }
  };

  const selectedWrapper = () => {
    if (isWindows) {
      return settings?.launch_command ?? "";
    }
    if (!wrappers.length) {
      return wrapperValue.trim();
    }
    return wrapperMode === "custom" ? wrapperValue.trim() : wrapperValue;
  };

  const onSave = async () => {
    if (!settings) {
      return;
    }
    // game_path is written by its own Browse button (and by Mods & Install);
    // spreading the current settings keeps that rather than a stale copy.
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

  const onToggleAdvanced = (checked: boolean) => {
    if (checked) {
      setAdvancedWarnOpen(true);
    } else {
      setShowAdvanced(false);
    }
  };

  const onCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const info = await checkLauncherUpdate();
      const launcherOutdated = Boolean(info?.remote && info.remote !== info.current);
      if (launcherOutdated) {
        setShowUpdateModal(true);
      }

      const v = await refreshVersions();
      const gameOutdated = Boolean(v?.remote && v.local !== v.remote);
      // A pending game patch is applied on the spot, same as the startup check.
      if (gameOutdated) {
        await autoUpdate();
      }

      if (!info?.remote && !v?.remote) {
        toast("Couldn't reach the update server, check the CDN base in Advanced.", true);
      } else if (!gameOutdated && !launcherOutdated) {
        toast("Everything is up to date");
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  const onReset = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      disarmTimer.current = setTimeout(() => setResetArmed(false), 4000);
      return;
    }
    clearTimeout(disarmTimer.current);
    setResetArmed(false);
    try {
      await resetSettings();
    } catch (e) {
      toast(String(e), true);
      return;
    }
    toast("Configuration reset");
    // Back to a first-run state, advanced options included.
    setShowAdvanced(false);
    refreshStatus();
    refreshPlayers();
    setView("home");
    // UIProvider reactively re-opens the wizard once it sees onboarded: false.
  };

  return (
    <section className={"view" + (view === "settings" ? " active" : "")}>
      <div className="panel">
        <div className="panel-head">
          <h3>Versions</h3>
          <div className="panel-actions">
            <button className="btn subtle" disabled={checkingUpdates} onClick={onCheckUpdates}>
              {checkingUpdates ? "Checking…" : "Check for updates"}
            </button>
          </div>
        </div>
        <div className="version-fields">
          <label className="field">
            <span>Game version</span>
            <input type="text" readOnly placeholder="unavailable" value={gameVersionField} />
          </label>
          <label className="field">
            <span>Launcher version</span>
            <input type="text" readOnly placeholder="unavailable" value={launcherVersionField} />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Launcher</h3>
        </div>
        <label className="field">
          <span>Game folder</span>
          <div className="form-row">
            <input type="text" readOnly placeholder="Not set" value={settings?.game_path ?? ""} />
            <button className="btn subtle" onClick={onBrowseGame}>
              Browse…
            </button>
          </div>
        </label>
        <label className="switch-row">
          <span>Minimize to taskbar when closing (X)</span>
          <Switch
            aria-label="Minimize to taskbar when closing (X)"
            checked={minimizeOnClose}
            onCheckedChange={setMinimizeOnClose}
          />
        </label>
        <label className="switch-row">
          <span>Close launcher when the game starts</span>
          <Switch
            aria-label="Close launcher when the game starts"
            checked={closeOnLaunch}
            onCheckedChange={setCloseOnLaunch}
          />
        </label>
      </div>

      <div className="panel">
        <label className="switch-row">
          <span>Show advanced options</span>
          {/* Reads as on while the warning is up; Back turns it off again. */}
          <Switch
            aria-label="Show advanced options"
            checked={showAdvanced || advancedWarnOpen}
            onCheckedChange={onToggleAdvanced}
          />
        </label>
      </div>

      {showAdvanced && (
        <div className="panel">
          <div className="panel-head">
            <h3>Advanced</h3>
          </div>

          {!isWindows && (
            <label className="field">
              <span>
                Launch wrapper{" "}
                <small>(Linux only; runs the game exe — Proton-GE recommended)</small>
              </span>
              {/* The picker stays put once "Custom…" is chosen — the free-text
                  box appears beside it rather than replacing it, so a detected
                  wrapper can still be picked back up. */}
              <div className="form-row">
                {wrappers.length > 0 && (
                  <Select
                    value={wrapperMode === "custom" ? CUSTOM_WRAPPER : wrapperValue}
                    onValueChange={(v) => {
                      if (v === CUSTOM_WRAPPER) {
                        setWrapperMode("custom");
                        setWrapperValue("");
                      } else {
                        setWrapperMode("select");
                        setWrapperValue(v);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {wrappers.map((w) => (
                        <SelectItem key={w.command} value={w.command}>
                          {w.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_WRAPPER}>Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {(wrapperMode === "custom" || wrappers.length === 0) && (
                  <input
                    type="text"
                    placeholder={
                      wrappers.length
                        ? "e.g. umu-run"
                        : "e.g. umu-run (none detected; install Wine or umu)"
                    }
                    value={wrapperValue}
                    onChange={(e) => setWrapperValue(e.target.value)}
                  />
                )}
              </div>
            </label>
          )}

          {!isWindows && (
            <label className="field">
              <span>
                Wine prefix{" "}
                <small>
                  (optional; passed as <code>WINEPREFIX</code>, empty = the launcher makes its own)
                </small>
              </span>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="e.g. /home/you/.wineprefixes/spellbreak"
                  value={winePrefix}
                  onChange={(e) => setWinePrefix(e.target.value)}
                />
                <button className="btn subtle" onClick={onBrowsePrefix}>
                  Browse…
                </button>
              </div>
            </label>
          )}

          <label className="field">
            <span>CDN base</span>
            <input type="text" value={cdnBase} onChange={(e) => setCdnBase(e.target.value)} />
          </label>
          <label className="field">
            <span>
              Auth URL{" "}
              <small>(token validation endpoint; the game server host is derived from it)</small>
            </span>
            <input
              type="text"
              placeholder="https://play.elefrac.com/auth"
              value={authUrl}
              onChange={(e) => setAuthUrl(e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Players URL <small>(players sidecar endpoint)</small>
            </span>
            <input
              type="text"
              placeholder="http://play.elefrac.com:4950/players"
              value={playersUrl}
              onChange={(e) => setPlayersUrl(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="save-row">
        <button
          className={"btn danger" + (resetArmed ? " armed" : "")}
          title="Clear all launcher settings and run first-time setup again"
          onClick={onReset}
        >
          {resetArmed ? "Click again to confirm reset" : "Reset configuration"}
        </button>
        <button className="btn primary" disabled={saving} onClick={onSave}>
          Save settings
        </button>
      </div>

      <AdvancedWarnModal
        open={advancedWarnOpen}
        onContinue={() => {
          setAdvancedWarnOpen(false);
          setShowAdvanced(true);
        }}
        onBack={() => {
          setAdvancedWarnOpen(false);
          setShowAdvanced(false);
        }}
      />
    </section>
  );
}
