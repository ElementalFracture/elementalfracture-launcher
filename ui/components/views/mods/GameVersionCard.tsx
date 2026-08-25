import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { useGame } from "@/context/GameContext";
import { toast } from "@/lib/toast";

/** The installed game version, and the manual check for a newer one. */
export function GameVersionCard() {
  const { versions, checkGameUpdate } = useGame();
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  // The CDN's current track, falling back to what's installed when it's unreachable.
  const gameVersionField = versions?.remote
    ? `v${versions.remote}`
    : versions?.local
      ? `v${versions.local} (installed)`
      : "";

  /* Manual game check: it reports, it doesn't patch — pulling the update is a
     click on Home's plate, so one never starts on its own. */
  const onCheckGameUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const { remote, outdated } = await checkGameUpdate();
      if (!remote) {
        toast(
          "Couldn't reach the update server, check the CDN base in Advanced.",
          true
        );
      } else if (outdated) {
        toast(`Game update available (v${remote}) — Launch it from Home.`);
      } else {
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
