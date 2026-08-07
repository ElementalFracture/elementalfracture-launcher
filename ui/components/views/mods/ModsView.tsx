import { useUI } from "@/context/UIContext";
import { AuthTokenCard } from "./AuthTokenCard";
import { GameCard } from "./GameCard";
import { GameVersionCard } from "./GameVersionCard";
import { ModsCard } from "./ModsCard";

/** The "Game & Mods" tab: install location, identity, and the mod pipeline. */
export function ModsView() {
  const { view } = useUI();

  return (
    <section className={"view" + (view === "mods" ? " active" : "")}>
      <GameCard />
      <AuthTokenCard />
      <ModsCard />
      <GameVersionCard />
    </section>
  );
}
