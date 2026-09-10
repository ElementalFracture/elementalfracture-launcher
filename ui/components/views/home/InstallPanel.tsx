import { Button } from "@/components/shadcn/button";
import { useGame } from "@/context/GameContext";
import { _ } from "@/i18n";
import "./InstallPanel.css";

/** What the banner shows instead of Launch while there is nothing to launch. */
export function InstallPanel() {
  const { status, installBusy, installNotice, locateGame, downloadGame } =
    useGame();

  const defaultMsg = !status?.game_path
    ? _("home.install.noInstall")
    : _("home.install.exeMissing");
  // The install notice takes over while a download runs or has just failed.
  const msg = installNotice ?? defaultMsg;

  return (
    <div>
      <p className="muted">{msg}</p>
      <div className="install-actions">
        <Button variant="secondary" disabled={installBusy} onClick={locateGame}>
          {_("home.install.locate")}
        </Button>
        <Button disabled={installBusy} onClick={downloadGame}>
          {_("home.install.download")}
        </Button>
      </div>
    </div>
  );
}
