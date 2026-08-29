import { useState } from "react";
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
import { useGame } from "@/context/GameContext";
import { atLeast } from "@/lib/timing";
import { toast } from "@/lib/toast";
import type { SettingsForm } from "./useSettingsForm";

export function LauncherCard({ form }: { form: SettingsForm }) {
  const {
    launcherInfo,
    checkLauncherUpdate,
    refreshVersions,
    setLauncherUpdatePop,
  } = useGame();
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const onCheckLauncherUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const info = await atLeast(checkLauncherUpdate());
      await refreshVersions();
      if (!info?.remote) {
        toast(
          "Couldn't reach the update server, check the CDN base in Settings.",
          true
        );
      } else if (info.remote !== info.current) {
        setLauncherUpdatePop(true);
      } else {
        toast("Launcher is up to date");
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Launcher
          {launcherInfo?.current && (
            <span className="title-note"> (v{launcherInfo.current})</span>
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
                Checking…
              </>
            ) : (
              "Check for launcher updates"
            )}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="switch-list">
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
            checked={form.minimizeOnClose}
            onCheckedChange={form.setMinimizeOnClose}
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
            checked={form.closeOnLaunch}
            onCheckedChange={form.setCloseOnLaunch}
          />
        </div>
      </CardContent>
    </Card>
  );
}
