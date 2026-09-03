import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { SignInForm } from "./SignInForm";
import type { TokenResult } from "@/lib/rust";
import { toast } from "@/lib/toast";
import { _ } from "@/i18n";
import "./Dialog.css";

export function AccountModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  /* Say who just signed in, then get out of the way. Closing unmounts the
     form, which is what clears the fields. */
  const onSignedIn = (res: TokenResult) => {
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="wizard-panel"
        showCloseButton={false}
        showOverlay={false}
      >
        {/* The form is `SignInForm`, shared with the wizard's sign-in step.
            All this adds is what happens after. */}
        <div className="wizard-step">
          <SignInForm onSignedIn={onSignedIn} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
