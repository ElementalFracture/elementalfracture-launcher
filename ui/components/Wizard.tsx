import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { openLink } from "@/lib/links";
import { toast } from "@/lib/toast";
import "./modals/Dialog.css";

const LINKS = {
  discord: "https://dsc.gg/elefrac",
  guide: "https://docs.elefrac.com/docs/intro",
};

type Step = "welcome" | "game" | "token" | "done";

export function Wizard() {
  const { showWizard, finishWizard } = useUI();
  const { settings, saveSettings, applyToken } = useSettings();
  const { provisionInstall } = useGame();

  const [step, setStep] = useState<Step>("welcome");
  const [gameResult, setGameResult] = useState("");
  const [gameBusy, setGameBusy] = useState(false);
  const [token, setToken] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [doneTitle, setDoneTitle] = useState("You're all set!");

  // Re-arm the wizard's local UI state each time it's (re)opened — this can
  // happen more than once per app lifetime via "Reset configuration".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (showWizard) {
      setStep("welcome");
      setGameResult("");
      setToken("");
      setDoneTitle("You're all set!");
    }
  }, [showWizard]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!showWizard) {
    return null;
  }

  const onLocateGame = async () => {
    setGameBusy(true);
    setGameResult("Looking for an existing install…");
    try {
      let dir = await rust.autoFindGame();
      if (!dir) {
        dir = await rust.pickGameDir("Select your Spellbreak folder (contains g3 and Engine)");
      }
      if (!dir) {
        setGameResult("No folder selected, you can set it any time in Settings.");
        return;
      }
      if (!settings) {
        return;
      }
      await saveSettings({ ...settings, game_path: dir });
      setGameResult("Hooked: " + dir + ", installing updates & mods…");
      await provisionInstall((msg, isError) => {
        setGameResult(isError ? msg : "Hooked: " + dir + ", " + msg.toLowerCase());
      });
      setTimeout(() => setStep("done"), 900);
    } catch (e) {
      setGameResult(String(e));
    } finally {
      setGameBusy(false);
    }
  };

  const onTokenSave = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      setStep("done");
      return;
    }
    setTokenBusy(true);
    try {
      const res = await applyToken(trimmed);
      if (res.verified && res.username) {
        setDoneTitle(`You're all set, ${res.username}!`);
      } else if (res.warning) {
        toast(res.warning, true);
      }
      setToken("");
      setStep("done");
    } catch (e) {
      toast(String(e), true);
    } finally {
      setTokenBusy(false);
    }
  };

  return (
    <Dialog open={showWizard} onOpenChange={() => {}}>
      <DialogContent
        className="wizard-panel"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === "welcome" && (
          <div className="wizard-step">
            <h2>Welcome to Elemental Fracture</h2>
            <p>We’re so glad you’re here.</p>
            <div className="wizard-actions">
              <Button onClick={() => setStep("game")}>Next</Button>
            </div>
          </div>
        )}

        {step === "game" && (
          <div className="wizard-step">
            <h2>Have you set up the game before?</h2>
            <p className="muted">
              If Spellbreak is already on this machine, point the launcher at its folder and you’re
              done.
            </p>
            <div className="wizard-actions">
              <Button disabled={gameBusy} onClick={onLocateGame}>
                Yes, locate my install
              </Button>
              <Button
                variant="secondary"
                disabled={gameBusy}
                onClick={() => setStep("token")}
              >
                No, not yet
              </Button>
            </div>
            {gameResult && <p className="muted wizard-result">{gameResult}</p>}
          </div>
        )}

        {step === "token" && (
          <div className="wizard-step">
            <h2>Authentication token</h2>
            <p className="muted">Your token identifies you on Elemental Fracture servers.</p>
            <Input
              type="password"
              placeholder="Paste your token…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="wizard-tooltip">
              Don’t have an authentication token?{" "}
              <a onClick={() => openLink(LINKS.discord)}>Join the Discord</a> and set up a token.{" "}
              <a onClick={() => openLink(LINKS.guide)}>Here’s the guide</a>.
            </p>
            <div className="wizard-actions">
              <Button disabled={tokenBusy} onClick={onTokenSave}>
                Save & continue
              </Button>
              <Button
                variant="secondary"
                disabled={tokenBusy}
                onClick={() => setStep("done")}
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="wizard-step">
            <h2>{doneTitle}</h2>
            <p className="muted">The Hollow Lands still beckon, breaker.</p>
            <div className="wizard-actions">
              <Button onClick={() => finishWizard()}>Enter the launcher</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
