import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdvancedWarnModal } from "@/components/modals/AdvancedWarnModal";
import { InfoPopover } from "@/components/InfoPopover";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import * as rust from "@/lib/rust";
import { isWindows } from "@/lib/platform";
import { toast } from "@/lib/toast";
import "./SettingsView.css";

const CUSTOM_WRAPPER = "__custom__";

export function computeWrapperState(
  cur: string,
  wrappers: { command: string }[]
) {
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
    launcherInfo,
    refreshStatus,
    checkLauncherUpdate,
    refreshVersions,
    provisionInstall,
    setLauncherUpdatePop,
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
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

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

  /* Manual launcher check. Unlike the startup one this compares versions
     directly (no marker guard); an update is offered by the corner popup that
     checkLauncherUpdate raises, never installed from here. */
  const onCheckLauncherUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const info = await checkLauncherUpdate();
      await refreshVersions();
      if (!info?.remote) {
        toast(
          "Couldn't reach the update server, check the CDN base in Advanced.",
          true
        );
      } else if (info.remote !== info.current) {
        // checkLauncherUpdate only raises the popup when the backend's own
        // marker agrees; a manual check goes on the version alone.
        setLauncherUpdatePop(true);
      } else {
        toast("Launcher is up to date");
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
      <Card>
        <CardHeader>
          <CardTitle>Launcher</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="field">
            <Label htmlFor="game-folder">Game folder</Label>
            <div className="form-row">
              <Input
                id="game-folder"
                type="text"
                readOnly
                placeholder="Not set"
                value={settings?.game_path ?? ""}
              />
              <Button variant="secondary" onClick={onBrowseGame}>
                Browse…
              </Button>
            </div>
          </div>
          <div className="switch-row">
            <span className="switch-text">
              <span>Minimize to taskbar when closing (X)</span>
              <InfoPopover>
                <p>
                  Pressing X hides the launcher to the taskbar instead of
                  quitting, so it stays running in the background. Quit it fully
                  from its tray/taskbar entry.
                </p>
              </InfoPopover>
            </span>
            <Switch
              aria-label="Minimize to taskbar when closing (X)"
              checked={minimizeOnClose}
              onCheckedChange={setMinimizeOnClose}
            />
          </div>
          <div className="switch-row">
            <span className="switch-text">
              <span>Close launcher when the game starts</span>
              <InfoPopover>
                <p>
                  Automatically closes the launcher a moment after the game
                  launches, to free up memory while you play.
                </p>
              </InfoPopover>
            </span>
            <Switch
              aria-label="Close launcher when the game starts"
              checked={closeOnLaunch}
              onCheckedChange={setCloseOnLaunch}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Launcher version</CardTitle>
          <CardAction className="panel-actions">
            <Button
              variant="secondary"
              disabled={checkingUpdates}
              onClick={onCheckLauncherUpdates}
            >
              {checkingUpdates ? "Checking…" : "Check for launcher updates"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="field">
            <Label htmlFor="launcher-version">Version</Label>
            <Input
              id="launcher-version"
              type="text"
              readOnly
              placeholder="unavailable"
              value={launcherVersionField}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="switch-row">
            <span className="switch-text">
              <span>Show advanced options</span>
              <InfoPopover>
                <p>
                  Reveals developer and debug settings: launch wrapper, Wine
                  prefix, and the CDN / auth / players URLs. Only change these
                  if you know what you’re doing.
                </p>
              </InfoPopover>
            </span>
            {/* Reads as on while the warning is up; Back turns it off again. */}
            <Switch
              aria-label="Show advanced options"
              checked={showAdvanced || advancedWarnOpen}
              onCheckedChange={onToggleAdvanced}
            />
          </div>
        </CardContent>
      </Card>

      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced</CardTitle>
          </CardHeader>
          <CardContent>
            {!isWindows && (
              <div className="field">
                <Label htmlFor="launch-wrapper">
                  Launch wrapper{" "}
                  <small>
                    (Linux only; runs the game exe — Proton-GE recommended)
                  </small>
                </Label>
                {/* The picker stays put once "Custom…" is chosen — the free-text
                    box appears beside it rather than replacing it, so a detected
                    wrapper can still be picked back up. */}
                <div className="form-row">
                  {wrappers.length > 0 && (
                    <Select
                      value={
                        wrapperMode === "custom" ? CUSTOM_WRAPPER : wrapperValue
                      }
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
                      {/* The label points at whichever control is the live
                          one; on Custom… that's the box below, not this. */}
                      <SelectTrigger
                        id={
                          wrapperMode === "custom" ? undefined : "launch-wrapper"
                        }
                      >
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
                    <Input
                      id="launch-wrapper"
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
              </div>
            )}

            {!isWindows && (
              <div className="field">
                <Label htmlFor="wine-prefix">
                  Wine prefix{" "}
                  <small>
                    (optional; passed as <code>WINEPREFIX</code>, empty = the
                    launcher makes its own)
                  </small>
                </Label>
                <div className="form-row">
                  <Input
                    id="wine-prefix"
                    type="text"
                    placeholder="e.g. /home/you/.wineprefixes/spellbreak"
                    value={winePrefix}
                    onChange={(e) => setWinePrefix(e.target.value)}
                  />
                  <Button variant="secondary" onClick={onBrowsePrefix}>
                    Browse…
                  </Button>
                </div>
              </div>
            )}

            <div className="field">
              <Label htmlFor="cdn-base">CDN base</Label>
              <Input
                id="cdn-base"
                type="text"
                value={cdnBase}
                onChange={(e) => setCdnBase(e.target.value)}
              />
            </div>
            <div className="field">
              <Label htmlFor="auth-url">
                Auth URL{" "}
                <small>
                  (token validation endpoint; the game server host is derived
                  from it)
                </small>
              </Label>
              <Input
                id="auth-url"
                type="text"
                placeholder="https://play.elefrac.com/auth"
                value={authUrl}
                onChange={(e) => setAuthUrl(e.target.value)}
              />
            </div>
            <div className="field">
              <Label htmlFor="players-url">
                Players URL <small>(players sidecar endpoint)</small>
              </Label>
              <Input
                id="players-url"
                type="text"
                placeholder="http://play.elefrac.com:4950/players"
                value={playersUrl}
                onChange={(e) => setPlayersUrl(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="save-row">
        <Button
          variant="destructive"
          className={resetArmed ? "armed" : undefined}
          title="Clear all launcher settings and run first-time setup again"
          onClick={onReset}
        >
          {resetArmed ? "Click again to confirm reset" : "Reset configuration"}
        </Button>
        <Button disabled={saving} onClick={onSave}>
          Save settings
        </Button>
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
