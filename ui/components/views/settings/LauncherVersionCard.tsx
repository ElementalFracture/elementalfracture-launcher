import { useState } from "react";
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
import { useGame } from "@/context/GameContext";
import { toast } from "@/lib/toast";

/* The game version lives in Game & Mods; only the launcher's is here. */
export function LauncherVersionCard() {
  const {
    launcherInfo,
    checkLauncherUpdate,
    refreshVersions,
    setLauncherUpdatePop,
  } = useGame();
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const versionField = (() => {
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

  return (
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
            value={versionField}
          />
        </div>
      </CardContent>
    </Card>
  );
}
