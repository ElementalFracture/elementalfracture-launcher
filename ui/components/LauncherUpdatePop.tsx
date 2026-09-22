import { useState } from "react";
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
  const { launcherInfo, launcherUpdatePop } = useGame();
  const [installing, setInstalling] = useState(false);

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
          <CardTitle className="update-pop-title">{_("update.title")}</CardTitle>
          <CardDescription className="update-pop-sub">
            {installing
              ? _("update.installing")
              : launcherInfo?.remote
                ? _("update.ready", { version: launcherInfo.remote })
                : _("update.click")}
          </CardDescription>
        </CardHeader>
        <CardContent className="update-pop-content">
          <Button
            size="lg"
            className="w-full"
            disabled={installing}
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
