import { useRef, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { toast } from "@/lib/toast";

/** Wipes the config back to a first-run state. Arms on the first click and
    disarms itself again shortly after, so it can't go off by accident. */
export function ResetButton() {
  const { setView } = useUI();
  const { resetSettings } = useSettings();
  const { refreshStatus } = useGame();
  const { refreshPlayers } = useLiveData();

  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const onClick = async () => {
    if (!armed) {
      setArmed(true);
      disarmTimer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    clearTimeout(disarmTimer.current);
    setArmed(false);
    try {
      await resetSettings();
    } catch (e) {
      toast(String(e), true);
      return;
    }
    toast("Configuration reset");
    refreshStatus();
    refreshPlayers();
    setView("home");
    // UIProvider reactively re-opens the wizard once it sees onboarded: false.
  };

  return (
    <Button
      variant="destructive"
      className={armed ? "armed" : undefined}
      title="Clear all launcher settings and run first-time setup again"
      onClick={onClick}
    >
      {armed ? "Click again to confirm reset" : "Reset configuration"}
    </Button>
  );
}
