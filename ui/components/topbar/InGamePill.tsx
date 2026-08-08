import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import { useLiveData } from "@/context/LiveDataContext";
import { InGameIcon } from "@/assets/icons/InGameIcon";
import {
  hasMultipleRegions,
  playersByVariant,
  regionSplit,
  type GameVariant,
} from "./players";
import "./InGamePill.css";

/** The two balance variants, in the order the breakdown lists them. */
const VARIANTS: readonly (readonly [GameVariant, string])[] = [
  ["ef", "Elemental Fracture"],
  ["classic", "Classic"],
];

/** Players in game, with a per-balance, per-mode breakdown behind a click. */
export function InGamePill() {
  const { playersData, refreshPlayers } = useLiveData();

  const inGame = Number.isFinite(playersData?.online)
    ? (playersData!.online as number)
    : null;

  const servers = playersData?.servers ?? [];
  const byVariant = playersByVariant(servers);
  const multiRegion = hasMultipleRegions(servers);

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
        {/* One heading per balance, each followed by its four mode rows
            (idle ones included, so the shape stays stable). The roster
            line only appears for a populated mode, keeping the two
            sections compact. */}
        {VARIANTS.map(([variant, variantLabel]) => (
          <div key={variant}>
            <div className="variant-head">{variantLabel}</div>
            {[...byVariant[variant]].map(([label, players]) => {
              const split =
                multiRegion && players.count > 0 ? regionSplit(players) : "";
              return (
                <div key={label}>
                  <div className="mode-row">
                    <span>{label}</span>
                    <span className="mode-count">
                      {split ? `${players.count} (${split})` : players.count}
                    </span>
                  </div>
                  {players.count > 0 && (
                    <div className="mode-names">
                      {players.names.length
                        ? players.names.join(", ")
                        : `${players.count} player(s)`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
