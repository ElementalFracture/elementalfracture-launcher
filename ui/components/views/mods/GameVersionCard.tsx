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

/** The installed game version, and the manual check for a newer one. */
export function GameVersionCard() {
  const { versions, refreshVersions, checkGameUpdate } = useGame();
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  // The CDN's current track, falling back to what's installed when it's unreachable.
  const gameVersionField = versions?.remote
    ? `v${versions.remote}`
    : versions?.local
      ? `v${versions.local} (installed)`
      : "";

  /* Manual game check: raises the corner popup rather than patching on the
     spot, so an update never starts without a click. */
  const onCheckGameUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const v = await refreshVersions();
      if (!v?.remote) {
        toast(
          "Couldn't reach the update server, check the CDN base in Advanced.",
          true
        );
        return;
      }
      if (!(await checkGameUpdate())) {
        toast("Game is up to date");
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  return (
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
  );
}
