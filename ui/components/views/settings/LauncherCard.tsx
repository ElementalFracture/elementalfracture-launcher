import { useEffect, useState } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Spinner } from "@/components/shadcn/spinner";
import { Switch } from "@/components/shadcn/switch";
import { InfoPopover } from "@/components/InfoPopover";
import { isWindows } from "@/lib/platform";
import { useGame } from "@/context/GameContext";
import { atLeast } from "@/lib/timing";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import { toastError } from "@/i18n/errors";
import { _ } from "@/i18n";
import type { SettingsForm } from "./useSettingsForm";

export function LauncherCard({ form }: { form: SettingsForm }) {
  const {
    launcherInfo,
    checkLauncherUpdate,
    refreshVersions,
    setLauncherUpdatePop,
  } = useGame();
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [elevated, setElevated] = useState(false);

  /* Elevation is a one-shot restart the player asks for here, never a
     setting: a launcher that re-elevated itself on every start read as
     malware keeping its foothold. */
  useEffect(() => {
    if (!isWindows) {
      return;
    }
    rust
      .launcherElevated()
      .then(setElevated)
      .catch(() => {});
  }, []);

  const onRelaunchAsAdmin = async () => {
    try {
      await rust.relaunchAsAdmin();
      // True means this copy is exiting; false, the player declined.
    } catch (e) {
      toastError(e);
    }
  };

  const onCheckLauncherUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const info = await atLeast(checkLauncherUpdate());
      await refreshVersions();
      if (!info?.remote) {
        toast(_("settings.launcher.unreachable"), true);
      } else if (info.remote !== info.current) {
        setLauncherUpdatePop(true);
      } else {
        toast(_("settings.launcher.upToDate"));
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {_("settings.launcher.title")}
          {launcherInfo?.current && (
            <span className="title-note">
              {_("settings.launcher.version", {
                version: launcherInfo.current,
              })}
            </span>
          )}
        </CardTitle>
        <CardAction className="panel-actions">
          <Button
            variant="secondary"
            disabled={checkingUpdates}
            onClick={onCheckLauncherUpdates}
          >
            {checkingUpdates ? (
              <>
                <Spinner />
                {_("settings.launcher.checking")}
              </>
            ) : (
              _("settings.launcher.checkUpdates")
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="switch-list">
        <div className="switch-row">
          <span className="switch-text">
            <span>{_("settings.launcher.minimizeOnClose")}</span>
            <InfoPopover>
              <p>{_("settings.launcher.minimizeOnCloseHelp")}</p>
            </InfoPopover>
          </span>
          <Switch
            aria-label={_("settings.launcher.minimizeOnClose")}
            checked={form.minimizeOnClose}
            onCheckedChange={form.setMinimizeOnClose}
          />
        </div>
        <div className="switch-row">
          <span className="switch-text">
            <span>{_("settings.launcher.closeOnLaunch")}</span>
            <InfoPopover>
              <p>{_("settings.launcher.closeOnLaunchHelp")}</p>
            </InfoPopover>
          </span>
          <Switch
            aria-label={_("settings.launcher.closeOnLaunch")}
            checked={form.closeOnLaunch}
            onCheckedChange={form.setCloseOnLaunch}
          />
        </div>
        {isWindows && (
          <div className="switch-row">
            <span className="switch-text">
              <span>{_("settings.launcher.runAsAdmin")}</span>
              <InfoPopover>
                <p>{_("settings.launcher.runAsAdminHelp")}</p>
              </InfoPopover>
            </span>
            {elevated ? (
              <span className="card-note">
                {_("settings.launcher.elevated")}
              </span>
            ) : (
              <Button variant="secondary" onClick={onRelaunchAsAdmin}>
                {_("settings.launcher.runAsAdmin")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
