import { useState } from "react";
import { useGame } from "@/context/GameContext";
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import "./LaunchPanel.css";

/** The banner's call to action once the game is installed. */
export function LaunchPanel() {
  const { settings } = useSettings();
  const { updating } = useGame();
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

  return (
    <div>
      <button
        className="launch-img"
        title={updating ? "Updating the game…" : "Launch Spellbreak"}
        disabled={launchBusy || updating}
        onClick={onLaunch}
      />
      <div className="launch-hint" />
    </div>
  );
}
