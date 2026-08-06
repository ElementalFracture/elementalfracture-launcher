import { Button } from "@/components/ui/button";
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
      <DialogContent
        className="wizard-panel"
        showCloseButton={false}
        showOverlay={false}
      >
        <div className="wizard-step">
          <h2>Advanced options</h2>
          <p className="muted">
            Warning: advanced options are meant for debugging or for custom
            configurations. Adjusting these settings may prevent you from
            playing the game without a full reset. Please only adjust these if
            you know what you’re doing!
          </p>
          <div className="wizard-actions">
            <Button onClick={onContinue}>Continue</Button>
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
