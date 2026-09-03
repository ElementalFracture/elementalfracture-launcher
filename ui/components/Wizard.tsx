import { useEffect, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { openLink } from "@/lib/links";
import { errorText } from "@/i18n/errors";
import { _ } from "@/i18n";
import "./modals/Dialog.css";

const LINKS = {
  discord: "https://dsc.gg/elefrac",
  register: "https://elefrac.com/register",
  guide: "https://elefrac.com/docs/quick-start-guide",
};

type Step = "welcome" | "game" | "signin" | "done";

export function Wizard() {
  const { showWizard, finishWizard } = useUI();
  const { settings, saveSettings, loginEmail } = useSettings();
  const { provisionInstall } = useGame();

  const [step, setStep] = useState<Step>("welcome");
  const [gameResult, setGameResult] = useState("");
  const [gameError, setGameError] = useState("");
  const [gameBusy, setGameBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signinBusy, setSigninBusy] = useState(false);
  const [signinError, setSigninError] = useState("");
  /* The name, not the finished sentence — the title is built at render, so a
     language picked after signing in still reads right. */
  const [doneName, setDoneName] = useState("");

  // Re-arm the wizard's local UI state each time it's (re)opened — this can
  // happen more than once per app lifetime via "Reset configuration".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (showWizard) {
      setStep("welcome");
      setGameResult("");
      setGameError("");
      setEmail("");
      setPassword("");
      setSigninError("");
      setDoneName("");
    }
  }, [showWizard]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!showWizard) {
    return null;
  }

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

  const onSignIn = async () => {
    if (!email.trim() || !password) {
      setSigninError(_("errors.enterEmailAndPassword"));
      return;
    }
    setSigninBusy(true);
    setSigninError("");
    try {
      const res = await loginEmail(email.trim(), password);
      setDoneName(res.username ?? "");
      setEmail("");
      setPassword("");
      setStep("done");
    } catch (e) {
      // loginEmail rejects with a coded auth failure; the sentence is picked
      // here, in whatever language is on screen.
      setSigninError(errorText(e));
    } finally {
      setSigninBusy(false);
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
            <h2>{_("account.title")}</h2>
            <p className="muted">{_("account.sub")}</p>
            <Input
              type="email"
              placeholder={_("account.email")}
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSigninError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && onSignIn()}
            />
            <Input
              type="password"
              placeholder={_("account.password")}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSigninError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && onSignIn()}
            />
            <p className="wizard-tooltip">
              <span className="tooltip-phrase">
                {_("wizard.noAccountYet")}
                <a onClick={() => openLink(LINKS.register)}>
                  {_("account.createOne")}
                </a>
              </span>
              <a onClick={() => openLink(LINKS.guide)}>
                {_("wizard.quickStart")}
              </a>
            </p>
            <div className="wizard-actions">
              <Button
                variant="secondary"
                disabled={signinBusy}
                onClick={() => setStep("done")}
              >
                {_("wizard.skip")}
              </Button>
              <Button disabled={signinBusy} onClick={onSignIn}>
                {signinBusy ? _("account.signingIn") : _("account.signIn")}
              </Button>
            </div>
            {signinError && (
              <p className="wizard-result wizard-error">{signinError}</p>
            )}
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
