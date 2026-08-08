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
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";

/** Where the game lives, and the two ways to get one. */
export function GameCard() {
  const {
    installBusy,
    installNotice,
    refreshStatus,
    locateGame,
    downloadGame,
    provisionInstall,
  } = useGame();
  const { settings, saveSettings } = useSettings();

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

  const gameLine =
    installNotice ??
    (settings?.game_path?.trim()
      ? "Game folder: " + settings.game_path.trim()
      : "No game folder set — Locate or Download the game.");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Game</CardTitle>
        <CardAction className="panel-actions">
          <Button
            variant="secondary"
            disabled={installBusy}
            onClick={locateGame}
          >
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
  );
}
