import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Spinner } from "@/components/shadcn/spinner";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { toastError } from "@/i18n/errors";
import { _ } from "@/i18n";
import "./LauncherUpdatePop.css";

export function LauncherUpdatePop() {
  const { launcherInfo, launcherUpdatePop, installBusy, updating } = useGame();
  const [installing, setInstalling] = useState(false);
  // The version an automatic attempt was made for: one try per release, and
  // the button stays for a manual retry if it fails.
  const autoTried = useRef<string | null>(null);

  const onApply = async () => {
    if (installing) {
      return;
    }
    setInstalling(true);
    try {
      // On success the backend restarts the launcher; this call never resolves.
      await rust.updateLauncher();
    } catch (e) {
      toastError(e);
      setInstalling(false);
    }
  };

  const isVisible = Boolean(launcherInfo?.update || launcherUpdatePop);
  const waitsForGame = Boolean(launcherInfo?.game_running);

  /* Updates apply themselves: a player should never have to notice a release
     to get it. Not mid-download (the restart would throw the transfer away)
     and not while the game runs (under Steam this process is its session). */
  useEffect(() => {
    const target = launcherInfo?.remote ?? null;
    if (!launcherInfo?.update || !target || waitsForGame) {
      return;
    }
    if (installing || installBusy || updating || autoTried.current === target) {
      return;
    }
    autoTried.current = target;
    void onApply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launcherInfo, waitsForGame, installing, installBusy, updating]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="update-modal-backdrop">
      <Card
        size="default"
        className={"update-pop-modal" + (installing ? " busy" : "")}
      >
        <CardHeader>
          <CardTitle className="update-pop-title">
            {_("update.title")}
          </CardTitle>
          <CardDescription className="update-pop-sub">
            {installing
              ? _("update.installing")
              : waitsForGame && launcherInfo?.remote
                ? _("update.afterGame", { version: launcherInfo.remote })
                : launcherInfo?.remote
                  ? _("update.ready", { version: launcherInfo.remote })
                  : _("update.click")}
          </CardDescription>
        </CardHeader>
        <CardContent className="update-pop-content">
          <Button
            size="lg"
            className="w-full"
            disabled={installing || waitsForGame}
            onClick={onApply}
          >
            {installing ? (
              <>
                <Spinner />
                <span>{_("update.installing")}</span>
              </>
            ) : (
              _("update.click")
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
