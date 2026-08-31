import { useState } from "react";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { toastError } from "@/i18n/errors";
import "./LauncherUpdatePop.css";

export function LauncherUpdatePop() {
  const { launcherInfo, launcherUpdatePop, setLauncherUpdatePop } = useGame();
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

  if (!launcherUpdatePop) {
    return null;
  }

  return (
    <Card
      size="sm"
      className={"update-pop" + (installing ? " busy" : "")}
      role="button"
      tabIndex={0}
      onClick={onApply}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onApply()}
    >
      <CardHeader>
        <CardTitle className="update-pop-title">
          Launcher Update Available
        </CardTitle>
        <CardDescription className="update-pop-sub">
          {installing
            ? "Installing…"
            : launcherInfo?.remote
              ? `v${launcherInfo.remote} ready · click to update`
              : "Click to update"}
        </CardDescription>
        <CardAction>
          <button
            className="update-pop-x"
            title="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setLauncherUpdatePop(false);
            }}
          >
            ×
          </button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}
