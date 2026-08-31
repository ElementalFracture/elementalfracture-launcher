import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { useSettings } from "@/context/SettingsContext";
import { openLink } from "@/lib/links";
import { toastError } from "@/i18n/errors";
import { toast } from "@/lib/toast";
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
      toast("Enter your email and password.", true);
      return;
    }
    setSaving(true);
    try {
      const res = await loginEmail(email.trim(), password);
      const badge = res.is_dev
        ? " (dev)"
        : res.is_staff
          ? " (staff)"
          : res.is_tester
            ? " (tester)"
            : "";
      toast(`Welcome back, ${res.username}${badge}!`);
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
          <h2>Sign in to Elemental Fracture</h2>
          <p className="muted">
            Use your Elemental Fracture email and password — the same account as
            the website.
          </p>
          <Input
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
          />
          <Input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && signIn()}
          />
          <p className="wizard-tooltip">
            <a onClick={() => openLink(RESET_URL)}>Forgot password?</a>
            {"  ·  "}
            No account? <a onClick={() => openLink(REGISTER_URL)}>Create one</a>
          </p>
          <div className="wizard-actions">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={signIn}>
              {saving ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
