import { useCallback, useEffect, useState } from "react";
import { useUI } from "@/context/UIContext";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import type { FileCheck } from "@/lib/rust";
import "./ModsView.css";

export function ModsView() {
  const { view } = useUI();
  const { status, versions, launcherInfo, refreshVersions, refreshStatus } = useGame();

  const [files, setFiles] = useState<FileCheck[] | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);

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

  const total = files?.length ?? 0;
  const missing = files?.filter((f) => !f.present).length ?? 0;

  const onUpdate = async () => {
    setUpdateBusy(true);
    try {
      const version = await rust.updatePatch();
      toast(version && version !== "unknown" ? `Updated to v{version}` : "Patch updated");
    } catch (e) {
      toast(String(e), true);
    } finally {
      setUpdateBusy(false);
      refreshVersions();
      refreshStatus();
    }
  };

  const onInstall = async () => {
    setInstallBusy(true);
    try {
      const lines = await rust.installMods();
      setLog(lines.join("\n"));
      toast("Mods installed");
    } catch (e) {
      setLog(String(e));
      toast("Install failed", true);
    } finally {
      setInstallBusy(false);
      refreshFiles();
    }
  };

  return (
    <section className={"view" + (view === "mods" ? " active" : "")}>
      <div className="panel">
        <div className="panel-head">
          <h3>Installation</h3>
          <div className="panel-actions">
            <button className="btn subtle" onClick={refreshFiles}>
              Verify
            </button>
            {outdated && (
              <button className="btn subtle" disabled={updateBusy} onClick={onUpdate}>
                {updateBusy ? "Updating…" : "Update game"}
              </button>
            )}
            <button className="btn primary" disabled={installBusy} onClick={onInstall}>
              {installBusy ? "Installing…" : "Install / Update mods"}
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
            ? "Set the game folder first (Home → Locate, or Settings)."
            : missing > 0
              ? `${missing} of ${total} file(s) missing — run Install / Update mods.`
              : ""}
        </div>

        {log !== null && <pre className="log">{log}</pre>}
      </div>
    </section>
  );
}
