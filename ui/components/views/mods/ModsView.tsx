import { useUI } from "@/context/UIContext";
import { GameCard } from "./GameCard";
import { ModsCard } from "./ModsCard";

/** The "Game & Mods" tab: install location and the mod pipeline. */
export function ModsView() {
  const { view } = useUI();

  return (
    <section className={"view" + (view === "mods" ? " active" : "")}>
      <GameCard />
      <ModsCard />
    </section>
  );
}
