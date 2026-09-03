import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { SignInForm } from "@/components/modals/SignInForm";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import type { TokenResult } from "@/lib/rust";
import { errorText } from "@/i18n/errors";
import { _ } from "@/i18n";
import "./modals/Dialog.css";

type Step = "welcome" | "game" | "signin" | "done";

export function Wizard() {
  const { showWizard } = useUI();
  return showWizard ? <WizardSteps /> : null;
}

function WizardSteps() {
  const { finishWizard } = useUI();
  const { settings, saveSettings } = useSettings();
  const { provisionInstall } = useGame();

  const [step, setStep] = useState<Step>("welcome");
  const [gameResult, setGameResult] = useState("");
  const [gameError, setGameError] = useState("");
  const [gameBusy, setGameBusy] = useState(false);
  /* The name, not the finished sentence — the title is built at render, so a
     language picked after signing in still reads right. */
  const [doneName, setDoneName] = useState("");

  const onSignedIn = (res: TokenResult) => {
    setDoneName(res.username ?? "");
    setStep("done");
  };

  const onLocateGame = async () => {
    setGameBusy(true);
    setGameError("");
    setGameResult(_("wizard.looking"));
    try {
      let dir = await rust.autoFindGame();
      if (!dir) {
        dir = await rust.pickGameDir(_("wizard.pickFolder"));
      }
      if (!dir) {
        setGameResult(_("wizard.noFolder"));
        return;
      }
      if (!settings) {
        return;
      }
      await saveSettings({ ...settings, game_path: dir });
      setGameResult(
        _("wizard.hooked", { path: dir, step: _("wizard.installingMods") })
      );
      const ok = await provisionInstall((msg, isError) => {
        if (isError) {
          setGameResult("");
          setGameError(msg);
        } else {
          setGameResult(
            _("wizard.hooked", { path: dir, step: msg.toLowerCase() })
          );
        }
      });
      // Only move on once the install actually succeeded — a failure leaves
      // the step up with its message, so it can be retried or skipped.
      if (ok) {
        setTimeout(() => setStep("signin"), 1000);
      }
    } catch (e) {
      setGameResult("");
      setGameError(errorText(e));
    } finally {
      setGameBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="wizard-panel"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === "welcome" && (
          <div className="wizard-step">
            <h2>{_("wizard.welcomeTitle")}</h2>
            <p>{_("wizard.welcomeSub")}</p>
            <div className="wizard-actions">
              <Button onClick={() => setStep("game")}>
                {_("wizard.next")}
              </Button>
            </div>
          </div>
        )}

        {step === "game" && (
          <div className="wizard-step">
            <h2>{_("wizard.gameTitle")}</h2>
            <p className="muted">{_("wizard.gameSub")}</p>
            <div className="wizard-actions">
              <Button
                variant="secondary"
                disabled={gameBusy}
                onClick={() => setStep("signin")}
              >
                {_("wizard.gameNo")}
              </Button>
              <Button disabled={gameBusy} onClick={onLocateGame}>
                {_("wizard.gameYes")}
              </Button>
            </div>
            {gameResult && <p className="muted wizard-result">{gameResult}</p>}
            {gameError && (
              <p className="wizard-result wizard-error">{gameError}</p>
            )}
          </div>
        )}

        {step === "signin" && (
          <div className="wizard-step">
            <SignInForm
              onSignedIn={onSignedIn}
              actions={
                <Button variant="ghost" onClick={() => setStep("done")}>
                  {_("wizard.skip")}
                </Button>
              }
            />
          </div>
        )}

        {step === "done" && (
          <div className="wizard-step">
            <h2>
              {doneName
                ? _("wizard.doneTitleNamed", { name: doneName })
                : _("wizard.doneTitle")}
            </h2>
            <p className="muted">{_("wizard.doneSub")}</p>
            <div className="wizard-actions">
              <Button onClick={() => finishWizard()}>
                {_("wizard.enter")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
