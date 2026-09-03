import { useState, type ReactNode } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { useSettings } from "@/context/SettingsContext";
import type { TokenResult } from "@/lib/rust";
import { openLink } from "@/lib/links";
import { URLS } from "@/lib/urls";
import { errorText } from "@/i18n/errors";
import { _ } from "@/i18n";
import "./Dialog.css";

export function SignInForm({
  onSignedIn,
  actions,
}: {
  onSignedIn: (res: TokenResult) => void;
  actions?: ReactNode;
}) {
  const { loginEmail } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signIn = async () => {
    if (!email.trim() || !password) {
      setError(_("errors.enterEmailAndPassword"));
      return;
    }
    setBusy(true);
    setError("");
    let res: TokenResult;
    try {
      res = await loginEmail(email.trim(), password);
    } catch (e) {
      setError(errorText(e));
      return;
    } finally {
      setBusy(false);
    }
    // Outside the try on purpose: what the caller does next — closing a dialog,
    // moving to another step — must not be caught and read as a bad password.
    onSignedIn(res);
  };

  /* Typing is the answer to the last failure, so the message goes as soon as
     the thing it complained about changes. */
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError("");
  };

  return (
    <>
      <h2>{_("account.title")}</h2>
      <p className="muted">{_("account.sub")}</p>
      <Input
        type="email"
        placeholder={_("account.email")}
        autoComplete="username"
        value={email}
        onChange={(e) => edit(setEmail)(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && signIn()}
      />
      <Input
        type="password"
        placeholder={_("account.password")}
        autoComplete="current-password"
        value={password}
        onChange={(e) => edit(setPassword)(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && signIn()}
      />
      <p className="wizard-tooltip">
        <a onClick={() => openLink(URLS.reset)}>{_("account.forgot")}</a>
      </p>
      <div className="wizard-actions stacked">
        <Button disabled={busy} onClick={signIn}>
          {busy ? _("account.signingIn") : _("account.signIn")}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => openLink(URLS.register)}
        >
          {_("account.createOne")}
        </Button>
      </div>
      {error && <p className="wizard-result wizard-error">{error}</p>}
      <p className="wizard-tooltip">
        <span className="tooltip-phrase">
          {_("account.needHelp")}
          <a onClick={() => openLink(URLS.quickStart)}>
            {_("account.quickStart")}
          </a>
        </span>
      </p>
      {actions && <div className="wizard-actions stacked">{actions}</div>}
    </>
  );
}
