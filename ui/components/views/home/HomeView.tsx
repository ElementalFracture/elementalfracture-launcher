import { useState } from "react";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { Banner } from "./Banner";
import { EventRow } from "./EventRow";
import { NewsRow } from "./NewsRow";
import { SocialRow } from "./SocialRow";
import { greeting } from "./format";
import "./HomeView.css";

/** The landing tab: greeting, banner, the live rows, and the social strip. */
export function HomeView() {
  const { view } = useUI();
  const { settings } = useSettings();

  const [greetPick] = useState(() => Math.floor(Math.random() * 2));
  const name = settings?.username?.trim() || "breaker";

  return (
    <section className={"view" + (view === "home" ? " active" : "")}>
      <h2 className="greet">{greeting(name, greetPick)}</h2>
      <Banner />
      <EventRow />
      <NewsRow />
      <SocialRow />
    </section>
  );
}
