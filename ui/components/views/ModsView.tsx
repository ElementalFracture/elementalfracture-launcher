import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { useUI } from "@/context/UIContext";
import { useGame } from "@/context/GameContext";
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import type { FileCheck } from "@/lib/rust";
import "./ModsView.css";

export function ModsView() {
  const { view } = useUI();
  const {
    status,
    versions,
    launcherInfo,
    installBusy,
    installNotice,
    refreshVersions,
    refreshStatus,
    locateGame,
    downloadGame,
    provisionInstall,
    checkGameUpdate,
  } = useGame();
  const { settings, saveSettings, applyToken } = useSettings();

  const [files, setFiles] = useState<FileCheck[] | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [modsBusy, setModsBusy] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [log, setLog] = useState<string | null>(null);

  const [token, setToken] = useState("");
  const [tokenConfirm, setTokenConfirm] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenLine, setTokenLine] = useState<string | null>(null);

  const refreshFiles = useCallback(async () => {
    try {
      const f = await rust.verifyInstall();
      setFiles(f);
    } catch (e) {
      toast(String(e), true);
    }
  }, []);

  // Re-pull install state from the backend every time this tab is selected.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (view === "mods") {
      refreshFiles();
      refreshVersions();
    }
  }, [view, refreshFiles, refreshVersions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const versionLine = [
    versions?.local ? `Game: v${versions.local}` : null,
    versions?.remote ? `Latest: v${versions.remote}` : null,
    launcherInfo?.current ? `Launcher: v${launcherInfo.current}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const outdated = Boolean(
    versions?.local && versions?.remote && versions.local !== versions.remote
  );

  // The CDN's current track, falling back to what's installed when it's unreachable.
  const gameVersionField = versions?.remote
    ? `v${versions.remote}`
    : versions?.local
      ? `v${versions.local} (installed)`
      : "";

  const total = files?.length ?? 0;
  const missing = files?.filter((f) => !f.present).length ?? 0;

  /* Repoint the install from here. Saved on the spot rather than behind a
     Save button: the provisioning below depends on the new folder. */
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

  /* Manual game check: raises the corner popup rather than patching on the
     spot, so an update never starts without a click. */
  const onCheckGameUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const v = await refreshVersions();
      if (!v?.remote) {
        toast("Couldn't reach the update server, check the CDN base in Advanced.", true);
        return;
      }
      if (!(await checkGameUpdate())) {
        toast("Game is up to date");
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  const onUpdate = async () => {
    setUpdateBusy(true);
    try {
      const version = await rust.updatePatch();
      toast(version && version !== "unknown" ? `Updated to v${version}` : "Patch updated");
    } catch (e) {
      toast(String(e), true);
    } finally {
      setUpdateBusy(false);
      refreshVersions();
      refreshStatus();
    }
  };

  const onInstall = async () => {
    setModsBusy(true);
    try {
      const lines = await rust.installMods();
      setLog(lines.join("\n"));
      toast("Mods installed");
    } catch (e) {
      setLog(String(e));
      toast("Install failed", true);
    } finally {
      setModsBusy(false);
      refreshFiles();
    }
  };

  const gameLine =
    installNotice ??
    (settings?.game_path?.trim()
      ? "Game folder: " + settings.game_path.trim()
      : "No game folder set — Locate or Download the game.");

  const signedInLine = settings?.auth_token?.trim()
    ? `Signed in as ${settings.username?.trim() || "you"}.`
    : "No token set yet.";

  /* Two-step entry: the token is write-only once saved, so a typo would
     otherwise only surface as a failed launch. */
  const onSaveToken = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      toast("Enter your token.", true);
      return;
    }
    if (trimmed !== tokenConfirm.trim()) {
      toast("Tokens don’t match.", true);
      setTokenLine("The two tokens don’t match — re-enter to confirm.");
      return;
    }
    setTokenBusy(true);
    try {
      const res = await applyToken(trimmed);
      if (res.verified && res.username) {
        const badge = res.is_dev ? " (dev)" : res.is_staff ? " (staff)" : "";
        toast(`Welcome, ${res.username}${badge}! Token saved.`);
        setTokenLine(`Signed in as ${res.username}${badge}.`);
      } else {
        toast(res.warning ?? "Token saved.", true);
        setTokenLine(res.warning ?? "Token saved (could not verify).");
      }
      setToken("");
      setTokenConfirm("");
    } catch (e) {
      toast(String(e), true);
      setTokenLine(String(e));
    } finally {
      setTokenBusy(false);
    }
  };

  return (
    <section className={"view" + (view === "mods" ? " active" : "")}>
      <Card>
        <CardHeader>
          <CardTitle>Game</CardTitle>
          <CardAction className="panel-actions">
            <Button variant="secondary" disabled={installBusy} onClick={locateGame}>
              Locate install
            </Button>
            <Button disabled={installBusy} onClick={downloadGame}>
              Download game…
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="field">
            <Label htmlFor="install-location">Install location</Label>
            <div className="form-row">
              <Input
                id="install-location"
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
          <div className="muted">{gameLine}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auth token</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="muted">
            Identifies you on Elemental Fracture. Only change this token when rotated by either
            yourself on Discord or by a mod.
          </p>
          <div className="field">
            <Label htmlFor="auth-token">Token</Label>
            <Input
              id="auth-token"
              type="password"
              placeholder="Paste your token…"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="field">
            <Label htmlFor="auth-token-confirm">Confirm token</Label>
            <Input
              id="auth-token-confirm"
              type="password"
              placeholder="Re-enter your token…"
              autoComplete="off"
              spellCheck={false}
              value={tokenConfirm}
              onChange={(e) => setTokenConfirm(e.target.value)}
            />
          </div>
          <div className="panel-actions">
            <Button disabled={tokenBusy} onClick={onSaveToken}>
              {tokenBusy ? "Saving…" : "Save token"}
            </Button>
          </div>
          <div className="muted">{tokenLine ?? signedInLine}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mods</CardTitle>
          <CardAction className="panel-actions">
            <Button variant="secondary" onClick={refreshFiles}>
              Verify
            </Button>
            {outdated && (
              <Button variant="secondary" disabled={updateBusy} onClick={onUpdate}>
                {updateBusy ? "Updating…" : "Update game"}
              </Button>
            )}
            <Button disabled={modsBusy} onClick={onInstall}>
              {modsBusy ? "Installing…" : "Install / Update mods"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {versionLine && <div className="muted">{versionLine}</div>}

          {status?.game_path && files ? (
            <div className="mods-status">
              <Badge
                variant="secondary"
                className={"badge " + (missing === 0 ? "ok" : "missing")}
              >
                {missing === 0 ? "INSTALLED" : "MISSING"}
              </Badge>
              <span>
                {missing === 0
                  ? "Mods are installed and ready."
                  : missing === total
                    ? "Mods are not installed."
                    : "Some mod files are missing."}
              </span>
            </div>
          ) : null}

          <div className="muted">
            {!status?.game_path
              ? "Set the game folder first — use Locate or Download above."
              : missing > 0
                ? `${missing} of ${total} file(s) missing — run Install / Update mods.`
                : ""}
          </div>

          {log !== null && <pre className="log">{log}</pre>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Game version</CardTitle>
          <CardAction className="panel-actions">
            <Button
              variant="secondary"
              disabled={checkingUpdates}
              onClick={onCheckGameUpdates}
            >
              {checkingUpdates ? "Checking…" : "Check for game updates"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="field">
            <Label htmlFor="game-version">Version</Label>
            <Input
              id="game-version"
              type="text"
              readOnly
              placeholder="unavailable"
              value={gameVersionField}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
