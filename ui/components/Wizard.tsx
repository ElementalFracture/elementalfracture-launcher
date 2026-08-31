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
  const [doneTitle, setDoneTitle] = useState("You're all set!");

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
      setDoneTitle("You're all set!");
    }
  }, [showWizard]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!showWizard) {
    return null;
  }

  const onLocateGame = async () => {
    setGameBusy(true);
    setGameError("");
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
      const ok = await provisionInstall((msg, isError) => {
        if (isError) {
          setGameResult("");
          setGameError(msg);
        } else {
          setGameResult("Hooked: " + dir + ", " + msg.toLowerCase());
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
      setSigninError("Enter your email and password.");
      return;
    }
    setSigninBusy(true);
    setSigninError("");
    try {
      const res = await loginEmail(email.trim(), password);
      setDoneTitle(`You're all set, ${res.username}!`);
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
              If Spellbreak is already on this machine, point the launcher at
              its folder and you’re done.
            </p>
            <div className="wizard-actions">
              <Button
                variant="secondary"
                disabled={gameBusy}
                onClick={() => setStep("signin")}
              >
                No, not yet
              </Button>
              <Button disabled={gameBusy} onClick={onLocateGame}>
                Yes, locate my install
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
            <h2>Sign in to Elemental Fracture</h2>
            <p className="muted">
              Use your Elemental Fracture email and password — the same account
              as the website.
            </p>
            <Input
              type="email"
              placeholder="Email"
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
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSigninError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && onSignIn()}
            />
            <p className="wizard-tooltip">
              Don’t have an account?{" "}
              <a onClick={() => openLink(LINKS.register)}>Create one</a>, or see
              the <a onClick={() => openLink(LINKS.guide)}>quick-start guide</a>.
            </p>
            <div className="wizard-actions">
              <Button
                variant="secondary"
                disabled={signinBusy}
                onClick={() => setStep("done")}
              >
                Skip for now
              </Button>
              <Button disabled={signinBusy} onClick={onSignIn}>
                {signinBusy ? "Signing in…" : "Sign in"}
              </Button>
            </div>
            {signinError && (
              <p className="wizard-result wizard-error">{signinError}</p>
            )}
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
