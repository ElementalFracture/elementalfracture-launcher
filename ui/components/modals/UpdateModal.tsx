import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import "./Dialog.css";

export function UpdateModal() {
  const { showUpdateModal, setShowUpdateModal, launcherInfo } = useGame();
  const [installing, setInstalling] = useState(false);

  if (!launcherInfo) {
    return null;
  }

  const onInstall = async () => {
    setInstalling(true);
    try {
      // On success the backend restarts the launcher; this call never resolves.
      await rust.updateLauncher();
    } catch (e) {
      toast(String(e), true);
      setInstalling(false);
    }
  };

  return (
    <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
      <DialogContent className="wizard-panel" showCloseButton={false}>
        <div className="wizard-step">
          <h2>New update available for launcher</h2>
          <p className="muted">
            Version {launcherInfo.remote} is ready to install (you have v{launcherInfo.current}).
          </p>
          <div className="wizard-actions">
            <button className="btn primary" disabled={installing} onClick={onInstall}>
              {installing ? "Installing…" : "Install"}
            </button>
            <button className="btn subtle" onClick={() => setShowUpdateModal(false)}>
              Not now
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
