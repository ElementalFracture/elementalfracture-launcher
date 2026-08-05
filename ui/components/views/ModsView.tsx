import { useCallback, useEffect, useState } from "react";
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
      <div className="panel">
        <div className="panel-head">
          <h3>Game</h3>
          <div className="panel-actions">
            <button className="btn subtle" disabled={installBusy} onClick={locateGame}>
              Locate install
            </button>
            <button className="btn primary" disabled={installBusy} onClick={downloadGame}>
              Download game…
            </button>
          </div>
        </div>
        <label className="field">
          <span>Install location</span>
          <div className="form-row">
            <input type="text" readOnly placeholder="Not set" value={settings?.game_path ?? ""} />
            <button className="btn subtle" onClick={onBrowseGame}>
              Browse…
            </button>
          </div>
        </label>
        <div className="muted">{gameLine}</div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Auth token</h3>
        </div>
        <p className="muted">
          Identifies you on Elemental Fracture. Only change this token when rotated by either
          yourself on Discord or by a mod.
        </p>
        <label className="field">
          <span>Token</span>
          <input
            type="password"
            placeholder="Paste your token…"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Confirm token</span>
          <input
            type="password"
            placeholder="Re-enter your token…"
            autoComplete="off"
            spellCheck={false}
            value={tokenConfirm}
            onChange={(e) => setTokenConfirm(e.target.value)}
          />
        </label>
        <div className="panel-actions">
          <button className="btn primary" disabled={tokenBusy} onClick={onSaveToken}>
            {tokenBusy ? "Saving…" : "Save token"}
          </button>
        </div>
        <div className="muted">{tokenLine ?? signedInLine}</div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Mods</h3>
          <div className="panel-actions">
            <button className="btn subtle" onClick={refreshFiles}>
              Verify
            </button>
            {outdated && (
              <button className="btn subtle" disabled={updateBusy} onClick={onUpdate}>
                {updateBusy ? "Updating…" : "Update game"}
              </button>
            )}
            <button className="btn primary" disabled={modsBusy} onClick={onInstall}>
              {modsBusy ? "Installing…" : "Install / Update mods"}
            </button>
          </div>
        </div>

        {versionLine && <div className="muted">{versionLine}</div>}

        {status?.game_path && files ? (
          <div className="mods-status">
            <span className={"badge " + (missing === 0 ? "ok" : "missing")}>
              {missing === 0 ? "INSTALLED" : "MISSING"}
            </span>
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
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Game version</h3>
          <div className="panel-actions">
            <button className="btn subtle" disabled={checkingUpdates} onClick={onCheckGameUpdates}>
              {checkingUpdates ? "Checking…" : "Check for game updates"}
            </button>
          </div>
        </div>
        <label className="field">
          <span>Version</span>
          <input type="text" readOnly placeholder="unavailable" value={gameVersionField} />
        </label>
      </div>
    </section>
  );
}
