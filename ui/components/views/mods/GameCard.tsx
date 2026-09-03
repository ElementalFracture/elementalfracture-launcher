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
import { toastError } from "@/i18n/errors";
import { _ } from "@/i18n";

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
      toast(_("game.folderUpdated"));
    } catch (e) {
      toastError(e);
    }
  };

  const onBrowseGame = async () => {
    if (!settings) {
      return;
    }
    try {
      const dir = await rust.pickGameDir(_("game.pickFolder"));
      if (dir) {
        await applyPath(dir);
      }
    } catch (e) {
      toastError(e);
    }
  };

  const onCheckGameUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const { remote, outdated } = await atLeast(checkGameUpdate());
      if (!remote) {
        toast(_("game.unreachable"), true);
      } else if (outdated) {
        toast(_("game.updateAvailable", { version: remote }));
      } else {
        toast(_("game.upToDate"));
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  const gameLine =
    installNotice ?? (savedPath.trim() ? "" : _("game.noFolder"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {_("game.title")}
          {versions?.local && (
            <span className="title-note">
              {_("game.version", { version: versions.local })}
            </span>
          )}
        </CardTitle>
        <CardAction className="panel-actions">
          <Button
            variant="secondary"
            disabled={installBusy}
            onClick={locateGame}
          >
            {_("game.locate")}
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
                  {_("game.checking")}
                </>
              ) : (
                _("game.checkUpdates")
              )}
            </Button>
          )}
          <Button disabled={installBusy} onClick={downloadGame}>
            {_("game.download")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="field">
          <Label htmlFor="install-location">{_("game.location")}</Label>
          <div className="form-row">
            <Input
              id="install-location"
              type="text"
              placeholder={_("game.locationPlaceholder")}
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
              {_("game.browse")}
            </Button>
            {edited && (
              <Button onClick={() => applyPath(shown.trim())}>
                {_("game.save")}
              </Button>
            )}
          </div>
        </div>
        {gameLine && <div className="muted">{gameLine}</div>}
      </CardContent>
    </Card>
  );
}
