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
import { Spinner } from "@/components/shadcn/spinner";
import { useGame } from "@/context/GameContext";
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { atLeast } from "@/lib/timing";
import { toast } from "@/lib/toast";

/** Where the game lives, which version it is, and the ways to get or move one. */
export function GameCard() {
  const {
    status,
    versions,
    installBusy,
    installNotice,
    refreshStatus,
    locateGame,
    downloadGame,
    provisionInstall,
    checkGameUpdate,
  } = useGame();
  const { settings, saveSettings } = useSettings();
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const savedPath = settings?.game_path ?? "";

  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? savedPath;
  const edited = draft !== null && draft.trim() !== savedPath.trim();

  const located = Boolean(status?.exe_present);

  /** Point the install at a folder and re-provision if a game is really there. */
  const applyPath = async (dir: string) => {
    if (!settings) {
      return;
    }
    try {
      await saveSettings({ ...settings, game_path: dir });
      setDraft(null);
      const fresh = await refreshStatus();
      if (fresh?.exe_present) {
        await provisionInstall();
      }
      toast("Game folder updated");
    } catch (e) {
      toast(String(e), true);
    }
  };

  const onBrowseGame = async () => {
    if (!settings) {
      return;
    }
    try {
      const dir = await rust.pickGameDir("Select your Spellbreak folder");
      if (dir) {
        await applyPath(dir);
      }
    } catch (e) {
      toast(String(e), true);
    }
  };

  const onCheckGameUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const { remote, outdated } = await atLeast(checkGameUpdate());
      if (!remote) {
        toast(
          "Couldn't reach the update server, check the CDN base in Settings.",
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

  const gameLine =
    installNotice ??
    (savedPath.trim()
      ? ""
      : "No game folder set — Locate or Download the game.");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Game
          {versions?.local && (
            <span className="title-note"> (v{versions.local})</span>
          )}
        </CardTitle>
        <CardAction className="panel-actions">
          <Button
            variant="secondary"
            disabled={installBusy}
            onClick={locateGame}
          >
            Locate install
          </Button>
          {located && (
            <Button
              variant="secondary"
              disabled={checkingUpdates}
              onClick={onCheckGameUpdates}
            >
              {checkingUpdates ? (
                <>
                  <Spinner />
                  Checking…
                </>
              ) : (
                "Check for game updates"
              )}
            </Button>
          )}
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
              placeholder="Not set"
              value={shown}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && edited) {
                  applyPath(shown.trim());
                } else if (e.key === "Escape") {
                  setDraft(null);
                }
              }}
            />
            <Button variant="secondary" onClick={onBrowseGame}>
              Browse…
            </Button>
            {edited && (
              <Button onClick={() => applyPath(shown.trim())}>Save</Button>
            )}
          </div>
        </div>
        {gameLine && <div className="muted">{gameLine}</div>}
      </CardContent>
    </Card>
  );
}
