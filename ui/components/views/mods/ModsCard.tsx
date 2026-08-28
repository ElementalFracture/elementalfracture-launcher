import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Spinner } from "@/components/shadcn/spinner";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { useUI } from "@/context/UIContext";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { atLeast } from "@/lib/spin";
import { toast } from "@/lib/toast";
import type { FileCheck } from "@/lib/rust";
import "./ModsCard.css";

/** Mod install state: what's on disk, what's behind, and the buttons to fix it. */
export function ModsCard() {
  const { view } = useUI();
  const { status, versions, refreshVersions, refreshStatus } = useGame();

  const [files, setFiles] = useState<FileCheck[] | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [modsBusy, setModsBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const refreshFiles = useCallback(async () => {
    try {
      const f = await rust.verifyInstall();
      setFiles(f);
    } catch (e) {
      toast(String(e), true);
    }
  }, []);

  const onVerify = async () => {
    setVerifying(true);
    try {
      await atLeast(refreshFiles());
    } finally {
      setVerifying(false);
    }
  };

  // Re-pull install state from the backend every time this tab is selected.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (view === "mods") {
      refreshFiles();
      refreshVersions();
    }
  }, [view, refreshFiles, refreshVersions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const outdated = Boolean(
    versions?.local && versions?.remote && versions.local !== versions.remote
  );

  const total = files?.length ?? 0;
  const missing = files?.filter((f) => !f.present).length ?? 0;

  const onUpdate = async () => {
    setUpdateBusy(true);
    try {
      const version = await rust.updatePatch();
      toast(
        version && version !== "unknown"
          ? `Updated to v${version}`
          : "Patch updated"
      );
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mods</CardTitle>
        <CardAction className="panel-actions">
          <Button variant="secondary" disabled={verifying} onClick={onVerify}>
            {verifying ? (
              <>
                <Spinner />
                Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>
          {outdated && (
            <Button
              variant="secondary"
              disabled={updateBusy}
              onClick={onUpdate}
            >
              {updateBusy ? "Updating…" : "Update game"}
            </Button>
          )}
          <Button disabled={modsBusy} onClick={onInstall}>
            {modsBusy ? "Installing…" : "Install / Update mods"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {verifying ? (
          <div className="mods-checking">
            <Spinner />
            <span>Checking mod files…</span>
          </div>
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
