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
import { atLeast } from "@/lib/timing";
import { toast } from "@/lib/toast";
import type { FileCheck } from "@/lib/rust";
import { errorText, toastError } from "@/i18n/errors";
import { versionsBehind } from "@/lib/versions";
import { _ } from "@/i18n";
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
  const [repairing, setRepairing] = useState(false);

  const refreshFiles = useCallback(async () => {
    try {
      const f = await rust.verifyInstall();
      setFiles(f);
    } catch (e) {
      toastError(e);
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

  /* "Verify" above answers off the local disk: it lists the mod DLLs and says
     which are there. This one checks the GAME against the release it came
     from — every file the base archive holds, by name and size — and puts back
     what is missing or truncated. That is the one thing no other button here
     can do: the update path only ever rewrites the patch and the mods, so an
     install that lost a file from the base archive (an older launcher that did
     not verify its own extraction, antivirus, a bad sector) stays broken
     however many times it is updated, and the player just sees the game refuse
     to start over a missing .sig. */
  const onRepair = async () => {
    setRepairing(true);
    try {
      const r = await rust.verifyGameFiles(true);
      if (r.unresolved.length > 0) {
        setLog(r.unresolved.join("\n"));
        toast(_("mods.repairStuck", { count: r.unresolved.length }), true);
      } else if (r.repaired > 0) {
        toast(_("mods.repairFixed", { count: r.repaired }));
      } else {
        toast(_("mods.repairChecked", { count: r.checked }));
      }
    } catch (e) {
      toastError(e);
    } finally {
      setRepairing(false);
      refreshFiles();
      refreshVersions();
      refreshStatus();
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

  /* This card's button applies the whole patch, balance pak and mods both, so
     it lights when either track is behind. */
  const outdated = versionsBehind(versions);

  const total = files?.length ?? 0;
  const missing = files?.filter((f) => !f.present).length ?? 0;

  const onUpdate = async () => {
    setUpdateBusy(true);
    try {
      const version = await rust.updatePatch();
      toast(
        version && version !== "unknown"
          ? _("mods.patched", { version })
          : _("mods.patchedUnknown")
      );
    } catch (e) {
      toastError(e);
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
      toast(_("mods.installDone"));
    } catch (e) {
      setLog(errorText(e));
      toast(_("mods.installFailed"), true);
    } finally {
      setModsBusy(false);
      refreshFiles();
    }
  };

  const localModVer = versions?.local_mod;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {_("mods.title")}
          {localModVer && (
            <span className="title-note">
              {_("game.version", { version: localModVer })}
            </span>
          )}
        </CardTitle>
        <CardAction className="panel-actions">
          <Button variant="secondary" disabled={verifying} onClick={onVerify}>
            {verifying ? (
              <>
                <Spinner />
                {_("mods.verifying")}
              </>
            ) : (
              _("mods.verify")
            )}
          </Button>
          {status?.game_path && (
            <Button
              variant="secondary"
              disabled={repairing}
              onClick={onRepair}
            >
              {repairing ? (
                <>
                  <Spinner />
                  {_("mods.repairing")}
                </>
              ) : (
                _("mods.repair")
              )}
            </Button>
          )}
          {outdated && (
            <Button
              variant="secondary"
              disabled={updateBusy}
              onClick={onUpdate}
            >
              {updateBusy ? _("mods.updating") : _("mods.update")}
            </Button>
          )}
          <Button disabled={modsBusy} onClick={onInstall}>
            {modsBusy ? _("mods.installing") : _("mods.install")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {verifying ? (
          <div className="mods-checking">
            <Spinner />
            <span>{_("mods.checkingFiles")}</span>
          </div>
        ) : (
          <>
            {status?.game_path && files ? (
              <div className="mods-status">
                <Badge
                  variant="secondary"
                  className={"badge " + (missing === 0 ? "ok" : "missing")}
                >
                  {missing === 0
                    ? _("mods.installedBadge")
                    : _("mods.missingBadge")}
                </Badge>
                <span>
                  {missing === 0
                    ? _("mods.ready")
                    : missing === total
                      ? _("mods.absent")
                      : _("mods.partial")}
                </span>
              </div>
            ) : null}

            <div className="muted">
              {!status?.game_path
                ? _("mods.noFolder")
                : missing > 0
                  ? _("mods.missingCount", { count: missing, total })
                  : ""}
            </div>

            {log !== null && <pre className="log">{log}</pre>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
