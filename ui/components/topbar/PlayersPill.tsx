import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import { useLiveData } from "@/context/LiveDataContext";
import { ChevronDown } from "lucide-react";
import { _ } from "@/i18n";
import {
  breakdownOf,
  regionsOf,
  totalsOf,
  type Family,
  type Flavor,
  type ModeRow,
} from "./players";
import "./PlayersPill.css";

const FAMILY_KEYS = {
  battleRoyale: "topbar.players.families.battleRoyale",
  dominion: "topbar.players.families.dominion",
  clash: "topbar.players.families.clash",
  other: "topbar.players.families.other",
} as const satisfies Record<Family, string>;

const FLAVOR_KEYS = {
  classic: "topbar.players.flavors.classic",
  test: "topbar.players.flavors.test",
} as const satisfies Record<Exclude<Flavor, "ef">, string>;

function modeName(row: ModeRow): string {
  return row.mode ? _(`topbar.players.modes.${row.mode}`) : row.label;
}

/**
 * Players online (everyone with the game open), with a breakdown behind a
 * click: how many are in a match or in the menus, then who is on which mode,
 * grouped by family, one column per region. The website's header widget
 * draws the same thing from the same endpoint.
 */
export function PlayersPill() {
  const { playersData, refreshPlayers } = useLiveData();
  const [open, setOpen] = useState(false);

  const { total, inMatch, inMenus } = totalsOf(playersData);
  const servers = playersData?.servers ?? [];
  const regions = regionsOf(servers);
  const sections = breakdownOf(servers, regions);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Refresh on open, so the breakdown is never a minute stale.
        if (next) {
          refreshPlayers();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="pill clickable players-pill"
          title={_("topbar.players.title")}
          data-live={total ? "1" : "0"}
        >
          <span className="players-dot" aria-hidden="true" />
          <span className="players-count">
            <strong>{total ?? "–"}</strong>{" "}
            {_("topbar.players.label", { count: total ?? 0 })}
          </span>
          <ChevronDown className="players-caret" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8}>
        <div className="player-breakdown">
          {total !== null && (
            <dl className="players-summary">
              <div>
                <dt>{_("topbar.players.inMatch")}</dt>
                <dd>{inMatch}</dd>
              </div>
              <div>
                <dt>{_("topbar.players.inMenus")}</dt>
                <dd>{inMenus}</dd>
              </div>
            </dl>
          )}
          {sections.length === 0 ? (
            <div className="no-one">{_("topbar.players.empty")}</div>
          ) : (
            sections.map(({ family, rows }) => (
              <table key={family} className="family-table">
                <thead>
                  <tr>
                    <th scope="col">{_(FAMILY_KEYS[family])}</th>
                    {regions.map((region) => (
                      <th key={region} scope="col">
                        {region || _("topbar.players.other")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">
                        <span className="mode-cell">
                          <span
                            className={row.live ? "mode-dot live" : "mode-dot"}
                            title={
                              row.live ? _("topbar.players.live") : undefined
                            }
                            aria-hidden="true"
                          />
                          <span className="mode-name">{modeName(row)}</span>
                          {row.flavor !== "ef" && (
                            <span className="flavor-tag">
                              {_(FLAVOR_KEYS[row.flavor])}
                            </span>
                          )}
                        </span>
                      </th>
                      {row.counts.map((count, column) => (
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
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
