import { Dialog, DialogContent } from "@/components/ui/dialog";
import "./Dialog.css";

export function AdvancedWarnModal({
  open,
  onContinue,
  onBack,
}: {
  open: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onBack()}>
      <DialogContent className="wizard-panel" showCloseButton={false}>
        <div className="wizard-step">
          <h2>Advanced options</h2>
          <p className="muted">
            Warning — advanced options are meant for debugging or for custom configurations.
            Adjusting these settings may prevent you from playing the game without a full reset.
            Please only adjust these if you know what you’re doing!
          </p>
          <div className="wizard-actions">
            <button className="btn primary" onClick={onContinue}>
              Continue
            </button>
            <button className="btn subtle" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
