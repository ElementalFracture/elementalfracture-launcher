import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/shadcn/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/shadcn/tabs";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { InGameIcon } from "@/assets/icons/InGameIcon";
import {
  playersByRegion,
  totalPlayers,
  variantTotal,
  type GameVariant,
} from "./players";
import "./InGamePill.css";

/** The two balance variants, in the order the breakdown lists them. */
const VARIANTS: readonly (readonly [GameVariant, string])[] = [
  ["ef", "Elemental Fracture"],
  ["classic", "Classic"],
];

/** Players in game, with a per-region, per-balance breakdown behind a click. */
export function InGamePill() {
  const { playersData, refreshPlayers } = useLiveData();
  const { status } = useGame();

  const inGame = Number.isFinite(playersData?.online)
    ? (playersData!.online as number)
    : null;

  const byRegion = playersByRegion(playersData?.servers ?? []);
  const regions = [...byRegion.keys()];
  // Held rather than left to `defaultValue`: the refresh on open can drop the
  // region that was picked, and the strip has to land somewhere real.
  const [region, setRegion] = useState<string | null>(null);
  const activeRegion = region && regions.includes(region) ? region : regions[0];
  // The balance this install runs is the one worth reading first; anything
  // else the backend reports ("unknown", missing) falls back to EF.
  const installed: GameVariant =
    status?.variant === "classic" ? "classic" : "ef";

  return (
    /* Refresh players on open, mak sure to have up-to-date data. */
    <Popover onOpenChange={(open) => open && refreshPlayers()}>
      <PopoverTrigger asChild>
        <button
          className="pill clickable"
          title="Players in game: click for a breakdown"
        >
          <InGameIcon className="pill-icon" />
          <div className="pill-text">
            <strong>{inGame ?? "–"}</strong>
            <small>in game</small>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8}>
        {/* One tab per region, and inside it one collapsible section per
            game variant — the installed variant opens first. Every known mode
            gets a row whether or not anyone is in it, so the panel keeps its
            shape; the idle ones just read muted. */}
        <Tabs
          value={activeRegion}
          onValueChange={(value) => setRegion(String(value))}
          className="region-tabs"
        >
          <TabsList className="w-full">
            {[...byRegion].map(([name, byVariant]) => (
              <TabsTrigger key={name} value={name}>
                {name}
                <span className="tab-count">{`(${totalPlayers(byVariant)})`}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {[...byRegion].map(([name, byVariant]) => (
            <TabsContent key={name} value={name}>
              {/* Keyed on the installed balance so a status that lands late
                  still opens the right section rather than sticking on EF. */}
              <Accordion key={installed} defaultValue={[installed]}>
                {VARIANTS.map(([variant, variantLabel]) => (
                  <AccordionItem key={variant} value={variant}>
                    <AccordionTrigger>
                      <span className="variant-title">{variantLabel}</span>
                      <span className="variant-count">
                        ({variantTotal(byVariant[variant])})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {[...byVariant[variant]].map(([label, players]) => (
                        <div
                          key={label}
                          className={
                            "mode-row" + (players.count === 0 ? " idle" : "")
                          }
                        >
                          <span>{label}</span>
                          <span className="mode-count">{players.count}</span>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
