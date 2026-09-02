import { useState } from "react";
import { useGame } from "@/context/GameContext";
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import { toastError } from "@/i18n/errors";
import { _ } from "@/i18n";
import { LaunchPlate } from "./LaunchPlate";
import "./LaunchPanel.css";

/** The banner's call to action once the game is installed. */
export function LaunchPanel() {
  const { settings } = useSettings();
  const { updating, gameOutdated, versions, applyGameUpdate, checkGameUpdate } =
    useGame();
  const [launchBusy, setLaunchBusy] = useState(false);

  /* Nothing is on a timer, so this is where the CDN gets asked: the only
     moment a stale answer has a consequence. Bounded, because a launcher that
     can't reach the CDN must still start the game — the check is a guard, not
     a gate, and 3s is well past a healthy answer (~100ms) while staying short
     enough not to feel like a hang. */
  const stillCurrent = async () => {
    const late = new Promise<{ outdated: boolean }>((resolve) =>
      setTimeout(() => resolve({ outdated: false }), 3000)
    );
    const { outdated } = await Promise.race([checkGameUpdate(), late]);
    return !outdated;
  };

  const onLaunch = async () => {
    setLaunchBusy(true);
    try {
      if (!(await stillCurrent())) {
        // checkGameUpdate refreshed the versions on its way, so `gameOutdated`
        // has already turned this plate into Update behind the toast.
        toast(_("home.launch.patchShipped"));
        return;
      }
      await rust.launchGame();
      toast(_("home.launch.launching"));
      // Opt-in (Settings → Launcher): quit once the game is on its way. Held
      // back a moment so the toast shows and the process is spawned first.
      if (settings?.close_on_launch) {
        setTimeout(() => {
          rust.quitLauncher().catch(() => {});
        }, 1200);
      }
    } catch (e) {
      toastError(e);
    } finally {
      setLaunchBusy(false);
    }
  };

  if (gameOutdated) {
    const target = versions?.remote;
    return (
      <div>
        <LaunchPlate
          label={updating ? _("home.launch.updating") : _("home.launch.update")}
          title={
            updating
              ? _("home.launch.downloadingTitle")
              : target
                ? _("home.launch.updateTitle", { version: target })
                : _("home.launch.updateTitleUnknown")
          }
          disabled={updating}
          onClick={() => {
            if (!updating) {
              applyGameUpdate();
            }
          }}
        />
        <div className="launch-hint">
          {target
            ? _("home.launch.hint", { version: target })
            : _("home.launch.hintUnknown")}
        </div>
      </div>
    );
  }

  return (
    <div>
      <LaunchPlate
        label={_("home.launch.launch")}
        title={
          updating
            ? _("home.launch.updatingTitle")
            : _("home.launch.launchTitle")
        }
        disabled={launchBusy || updating}
        onClick={onLaunch}
      />
      <div className="launch-hint" />
    </div>
  );
}
