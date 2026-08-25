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
import { toast } from "@/lib/toast";
import "./UpdatePops.css";

/** One bottom-corner card: click the body to apply, the × to dismiss. */
function UpdatePop({
  title,
  sub,
  busy,
  onApply,
  onDismiss,
}: {
  title: string;
  sub: string;
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card
      size="sm"
      className={"update-pop" + (busy ? " busy" : "")}
      role="button"
      tabIndex={0}
      onClick={onApply}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onApply()}
    >
      <CardHeader>
        <CardTitle className="update-pop-title">{title}</CardTitle>
        <CardDescription className="update-pop-sub">{sub}</CardDescription>
        <CardAction>
          <button
            className="update-pop-x"
            title="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
          >
            ×
          </button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

/**
 * Pending updates, announced as corner popups rather than a modal or a silent
 * background patch: nothing is installed until the player clicks one.
 */
export function UpdatePops() {
  const {
    launcherInfo,
    launcherUpdatePop,
    setLauncherUpdatePop,
    gameUpdatePop,
    dismissGameUpdatePop,
    applyGameUpdate,
    updating,
  } = useGame();
  const [installingLauncher, setInstallingLauncher] = useState(false);

  const onLauncherUpdate = async () => {
    if (installingLauncher) {
      return;
    }
    setInstallingLauncher(true);
    try {
      // On success the backend restarts the launcher; this call never resolves.
      await rust.updateLauncher();
    } catch (e) {
      toast(String(e), true);
      setInstallingLauncher(false);
    }
  };

  return (
    <div id="update-pops">
      {launcherUpdatePop && (
        <UpdatePop
          title="Launcher Update Available"
          sub={
            installingLauncher
              ? "Installing…"
              : launcherInfo?.remote
                ? `v${launcherInfo.remote} ready · click to update`
                : "Click to update"
          }
          busy={installingLauncher}
          onApply={onLauncherUpdate}
          onDismiss={() => setLauncherUpdatePop(false)}
        />
      )}
      {gameUpdatePop !== null && (
        <UpdatePop
          title="Game Update Available"
          sub={
            updating
              ? "Updating…"
              : gameUpdatePop
                ? `v${gameUpdatePop} ready · click to update`
                : "Click to update"
          }
          busy={updating}
          onApply={() => {
            if (!updating) {
              applyGameUpdate();
            }
          }}
          onDismiss={dismissGameUpdatePop}
        />
      )}
    </div>
  );
}
