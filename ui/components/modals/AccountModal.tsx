import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { useSettings } from "@/context/SettingsContext";
import { openLink } from "@/lib/links";
import { toastError } from "@/i18n/errors";
import { toast } from "@/lib/toast";
import { _ } from "@/i18n";
import "./Dialog.css";

// The account website (registration, email verification, password reset).
const SITE = "https://elefrac.com";
const REGISTER_URL = `${SITE}/register`;
const RESET_URL = `${SITE}/reset`;

export function AccountModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { loginEmail } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
  };

  const signIn = async () => {
    if (!email.trim() || !password) {
      toast(_("errors.enterEmailAndPassword"), true);
      return;
    }
    setSaving(true);
    try {
      const res = await loginEmail(email.trim(), password);
      const role = res.is_dev
        ? _("account.roleDev")
        : res.is_staff
          ? _("account.roleStaff")
          : res.is_tester
            ? _("account.roleTester")
            : "";
      const name = res.username ?? "";
      toast(
        role
          ? _("account.welcomeBackAs", { name, role })
          : _("account.welcomeBack", { name })
      );
      reset();
      onOpenChange(false);
    } catch (e) {
      // loginEmail throws a friendly message on any auth failure.
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="wizard-panel"
        showCloseButton={false}
        showOverlay={false}
      >
        <div className="wizard-step">
          <h2>{_("account.title")}</h2>
          <p className="muted">{_("account.sub")}</p>
          <Input
            type="email"
            placeholder={_("account.email")}
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
          />
          <Input
            type="password"
            placeholder={_("account.password")}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
          />
          <p className="wizard-tooltip">
            <a onClick={() => openLink(RESET_URL)}>{_("account.forgot")}</a>
            {"  ·  "}
            {_("account.noAccount")}{" "}
            <a onClick={() => openLink(REGISTER_URL)}>
              {_("account.createOne")}
            </a>
          </p>
          <div className="wizard-actions">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {_("account.cancel")}
            </Button>
            <Button disabled={saving} onClick={signIn}>
              {saving ? _("account.signingIn") : _("account.signIn")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
