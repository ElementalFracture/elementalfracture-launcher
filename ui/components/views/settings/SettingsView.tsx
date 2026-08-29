import { useUI } from "@/context/UIContext";
import { isWindows } from "@/lib/platform";
import { LauncherCard } from "./LauncherCard";
import { ResetButton } from "./ResetButton";
import { UrlsCard } from "./UrlsCard";
import { WrapperCard } from "./WrapperCard";
import { useSettingsForm } from "./useSettingsForm";
import "./SettingsView.css";

/** The Settings tab. Every field writes as you leave it — there is no Save —
    but they share one writer, so the form state lives here (in useSettingsForm)
    rather than in the cards that draw it. */
export function SettingsView() {
  const { view } = useUI();
  const form = useSettingsForm();

  return (
    <section className={"view" + (view === "settings" ? " active" : "")}>
      <LauncherCard form={form} />
      {/* Both of its fields are Wine's; on Windows there is nothing to show. */}
      {!isWindows && <WrapperCard form={form} />}
      <UrlsCard form={form} />

      <div className="reset-row">
        <ResetButton />
      </div>
    </section>
  );
}
