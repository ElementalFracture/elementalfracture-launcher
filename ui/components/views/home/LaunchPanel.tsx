import { useState } from "react";
import { useGame } from "@/context/GameContext";
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import { LaunchPlate } from "./LaunchPlate";
import "./LaunchPanel.css";

/** The banner's call to action once the game is installed. */
export function LaunchPanel() {
  const { settings } = useSettings();
  const { updating, gameOutdated, gameUpdatePop, versions, applyGameUpdate } =
    useGame();
  const [launchBusy, setLaunchBusy] = useState(false);

  const onLaunch = async () => {
    setLaunchBusy(true);
    try {
      await rust.launchGame();
      toast("Launching Spellbreak…");
      // Opt-in (Settings → Launcher): quit once the game is on its way. Held
      // back a moment so the toast shows and the process is spawned first.
      if (settings?.close_on_launch) {
        setTimeout(() => {
          rust.quitLauncher().catch(() => {});
        }, 1200);
      }
    } catch (e) {
      toast(String(e), true);
    } finally {
      setLaunchBusy(false);
    }
  };

  if (gameOutdated) {
    // gameUpdatePop carries the offered version once the startup check has
    // run; the versions the views read are the fallback before that.
    const target = gameUpdatePop ?? versions?.remote;
    return (
      <div>
        <LaunchPlate
          label={updating ? "Updating" : "Update"}
          title={
            updating
              ? "Downloading the game update…"
              : target
                ? `Download game update v${target}`
                : "Download the game update"
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
            ? `Version ${target} is out — update to play.`
            : "A game update is out — update to play."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <LaunchPlate
        label="Launch"
        title={updating ? "Updating the game…" : "Launch Spellbreak"}
        disabled={launchBusy || updating}
        onClick={onLaunch}
      />
      <div className="launch-hint" />
    </div>
  );
}
