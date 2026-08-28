import { useState } from "react";
import { useUI } from "@/context/UIContext";
import { AdvancedCard } from "./AdvancedCard";
import { AdvancedToggleCard } from "./AdvancedToggleCard";
import { LauncherCard } from "./LauncherCard";
import { ResetButton } from "./ResetButton";
import { useSettingsForm } from "./useSettingsForm";
import "./SettingsView.css";

/** The Settings tab. Every field writes as you leave it — there is no Save —
    but they share one writer, so the form state lives here (in useSettingsForm)
    rather than in the cards that draw it. */
export function SettingsView() {
  const { view } = useUI();
  const form = useSettingsForm();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className={"view" + (view === "settings" ? " active" : "")}>
      <LauncherCard form={form} />
      <AdvancedToggleCard
        shown={showAdvanced}
        onShownChange={setShowAdvanced}
      />
      {showAdvanced && <AdvancedCard form={form} />}

      <div className="reset-row">
        <ResetButton onReset={() => setShowAdvanced(false)} />
      </div>
    </section>
  );
}
