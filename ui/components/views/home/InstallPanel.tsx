import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import "./InstallPanel.css";

/** What the banner shows instead of Launch while there is nothing to launch. */
export function InstallPanel() {
  const { status, installBusy, installNotice, locateGame, downloadGame } =
    useGame();

  const defaultMsg = !status?.game_path
    ? "No Spellbreak install configured. Locate an existing install or download the game."
    : "Spellbreak.exe was not found in the configured folder. Locate the right folder or re-download.";
  // The install notice takes over while a download runs or has just failed.
  const msg = installNotice ?? defaultMsg;

  return (
    <div>
      <p className="muted">{msg}</p>
      <div className="install-actions">
        <Button variant="secondary" disabled={installBusy} onClick={locateGame}>
          Locate existing install
        </Button>
        <Button disabled={installBusy} onClick={downloadGame}>
          Download game…
        </Button>
      </div>
    </div>
  );
}
