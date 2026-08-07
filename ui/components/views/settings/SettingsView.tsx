import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUI } from "@/context/UIContext";
import { AdvancedCard } from "./AdvancedCard";
import { AdvancedToggleCard } from "./AdvancedToggleCard";
import { LauncherCard } from "./LauncherCard";
import { LauncherVersionCard } from "./LauncherVersionCard";
import { ResetButton } from "./ResetButton";
import { useSettingsForm } from "./useSettingsForm";
import "./SettingsView.css";

/** The Settings tab. One Save button covers every card's fields, so the form
    state lives here (in useSettingsForm) rather than in the cards. */
export function SettingsView() {
  const { view } = useUI();
  const form = useSettingsForm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className={"view" + (view === "settings" ? " active" : "")}>
      <LauncherCard form={form} />
      <LauncherVersionCard />
      <AdvancedToggleCard
        shown={showAdvanced}
        onShownChange={setShowAdvanced}
      />
      {showAdvanced && <AdvancedCard form={form} />}

      <div className="save-row">
        <ResetButton onReset={() => setShowAdvanced(false)} />
        <Button disabled={form.saving} onClick={form.onSave}>
          Save settings
        </Button>
      </div>
    </section>
  );
}
