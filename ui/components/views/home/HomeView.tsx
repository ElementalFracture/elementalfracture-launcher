import { useState } from "react";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { Banner } from "./Banner";
import { EventRow } from "./EventRow";
import { NewsRow } from "./NewsRow";
import { greeting } from "./format";
import { _ } from "@/i18n";
import "./HomeView.css";

export function HomeView() {
  const { view } = useUI();
  const { settings } = useSettings();

  const [greetPick] = useState(() => Math.floor(Math.random() * 2));
  const name = settings?.username?.trim() || _("home.greeting.fallbackName");

  return (
    <section className={"view" + (view === "home" ? " active" : "")}>
      <h2 className="greet">{greeting(name, greetPick)}</h2>
      <Banner />
      <EventRow />
      <NewsRow />
    </section>
  );
}
