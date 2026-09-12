import { useRef, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { toast } from "@/lib/toast";
import { _ } from "@/i18n";
import { toastError } from "@/i18n/errors";

/** Puts the fields on this view back to their defaults — the session, the
    install and onboarding are written elsewhere and are left alone. Arms on
    the first click and disarms itself again shortly after, so it can't go off
    by accident. */
export function ResetButton() {
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
      toastError(e);
      return;
    }
    toast(_("settings.reset.done"));
    // The wrapper and the URLs are back to defaults, so whatever reads them
    // is re-pulled — same rule the form itself follows for a REPOINTS field.
    refreshStatus();
    refreshPlayers();
  };

  return (
    <Button
      variant="destructive"
      className={armed ? "armed" : undefined}
      title={_("settings.reset.title")}
      onClick={onClick}
    >
      {armed ? _("settings.reset.confirm") : _("settings.reset.button")}
    </Button>
  );
}
