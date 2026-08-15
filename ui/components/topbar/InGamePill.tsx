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
import { RosterModal, type Roster } from "@/components/modals/RosterModal";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { InGameIcon } from "@/assets/icons/InGameIcon";
import { PlayersIcon } from "@/assets/icons/PlayersIcon";
import { GAME_VARIANTS, toGameVariant } from "@/lib/gameVariant";
import { playersByRegion, totalPlayers, variantTotal } from "./players";
import "./InGamePill.css";

/** Players in game, with a per-region, per-balance breakdown behind a click. */
export function InGamePill() {
  const { playersData, refreshPlayers } = useLiveData();
  const { status } = useGame();
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<Roster | null>(null);

  const inGame = Number.isFinite(playersData?.online)
    ? (playersData!.online as number)
    : null;

  const byRegion = playersByRegion(playersData?.servers ?? []);
  const regions = [...byRegion.keys()];
  // Held rather than left to `defaultValue`: the refresh on open can drop the
  // region that was picked, and the strip has to land somewhere real.
  const [region, setRegion] = useState<string | null>(null);
  const activeRegion = region && regions.includes(region) ? region : regions[0];
  // Show the installed game variant when opening the popover
  const installed = toGameVariant(status?.variant);

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          // The roster dialog takes focus off the popover, which would dismiss
          // it; hold the breakdown open so closing the dialog comes back to it.
          if (!next && roster) {
            return;
          }
          setOpen(next);
          // Refresh players on open, mak sure to have up-to-date data.
          if (next) {
            refreshPlayers();
          }
        }}
      >
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
            gets a row whether anyone is in it, so the panel keeps its
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
                <Accordion key={installed} defaultValue={[installed]}>
                  {GAME_VARIANTS.map(({ id, label: variantLabel }) => (
                    <AccordionItem key={id} value={id}>
                      <AccordionTrigger>
                        <span className="variant-title">{variantLabel}</span>
                        <span className="variant-count">
                          ({variantTotal(byVariant[id])})
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {[...byVariant[id]].map(([label, players]) => (
                          <div
                            key={label}
                            className={
                              "mode-row" + (players.count === 0 ? " idle" : "")
                            }
                          >
                            <span>{label}</span>
                            <span className="game-mode-row-right">
                              {players.count > 0 && (
                                <button
                                  className="game-mode-players"
                                  aria-label={`Who is in ${label} (${variantLabel}, ${name})`}
                                  title="Players in this mode"
                                  onClick={() =>
                                    setRoster({
                                      region: name,
                                      variant: variantLabel,
                                      mode: label,
                                      names: players.names,
                                    })
                                  }
                                >
                                  <PlayersIcon aria-hidden="true" />
                                </button>
                              )}
                              <span className="game-mode-count">
                                {players.count}
                              </span>
                            </span>
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

      <RosterModal roster={roster} onClose={() => setRoster(null)} />
    </>
  );
}
