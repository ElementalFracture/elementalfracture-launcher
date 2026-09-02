import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import { useLiveData } from "@/context/LiveDataContext";
import { Swords } from "lucide-react";
import { GAME_VARIANTS } from "@/lib/gameVariant";
import { _ } from "@/i18n";
import { modeRowsByVariant, regionsOf } from "./players";
import "./InGamePill.css";
import { Separator } from "@/components/shadcn/separator.tsx";

/** Players in game, with a per-gameVariant, per-region breakdown behind a click. */
export function InGamePill() {
  const { playersData, refreshPlayers } = useLiveData();
  const [open, setOpen] = useState(false);

  const inGame = Number.isFinite(playersData?.online)
    ? (playersData!.online as number)
    : null;

  const servers = playersData?.servers ?? [];
  const regions = regionsOf(servers);
  const rowsByGameVariant = modeRowsByVariant(servers, regions);
  // A game variant with no populated mode has nothing to table, so it drops
  // out — which is what keeps the playtest section out of everyone's popover
  // until a playtest lobby actually has someone in it.
  const sections = GAME_VARIANTS.filter(
    ({ id }) => rowsByGameVariant[id].length > 0
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Refresh players on open, mak sure to have up-to-date data.
        if (next) {
          refreshPlayers();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button className="pill clickable" title={_("topbar.ingame.title")}>
          <Swords className="pill-icon" />
          <div className="pill-text">
            <strong>{inGame ?? "–"}</strong>
            <small>{_("topbar.ingame.label")}</small>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8}>
        <div className="player-breakdown">
          {sections.length === 0 ? (
            <div className="no-one">{_("topbar.ingame.empty")}</div>
          ) : (
            sections.map(({ id, label: variantLabel }) => (
              <section key={id} className="variant-section">
                <h3 className="variant-title">{variantLabel}</h3>
                <Separator />
                <table className="mode-table">
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">
                          {_("topbar.ingame.mode")}
                        </span>
                      </th>
                      {regions.map((region) => (
                        <th key={region} scope="col">
                          {region}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowsByGameVariant[id].map(({ label, counts }) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        {counts.map((count, column) => (
                          <td
                            key={regions[column]}
                            className={count === 0 ? "idle" : undefined}
                          >
                            {count}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
