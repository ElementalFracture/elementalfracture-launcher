import type { PlayerServer } from "@/lib/rust";
import type { GameVariant } from "@/lib/gameVariant";

/** Server-name pattern → the mode bucket it belongs in. */
const MODE_MATCHERS: readonly (readonly [RegExp, string])[] = [
  [/solo/i, "Solos"],
  [/duo/i, "Duos"],
  [/squad/i, "Squads"],
  [/arena|tdm|capture/i, "Arena/TDM"],
];

/**
 * Which balance a server runs, read off its names — the sidecar reports no
 * variant of its own, so the naming conventions the server manager uses are
 * the only signal there is.
 *
 * Classic servers are the manager's dynamic vanilla groups: container name
 * vsolo/vduos/… and display "Classic <Mode> N". Playtest lobbies follow the
 * same shape one letter over — container ptsolo/ptduos/… and display
 * "Playtest <Mode> N". Anything else is an Elemental Fracture server.
 */
export function variantOf(server: PlayerServer): GameVariant {
  const name = server.name || "";
  const display = server.display_name || "";
  if (/^pt(solo|duo|squad|arena)/i.test(name) || /^playtest\b/i.test(display)) {
    return "playtest";
  }
  if (/^v(solo|duo|squad|arena)/i.test(name) || /^classic\b/i.test(display)) {
    return "classic";
  }
  return "ef";
}

export function modeLabel(server: PlayerServer) {
  const serverName = server.display_name || server.name || "";
  for (const [pattern, label] of MODE_MATCHERS) {
    if (pattern.test(serverName)) {
      return label;
    }
  }
  return serverName || "Other";
}

/** Regions the breakdown leads with, in order; anything else trails them. */
const REGION_ORDER: readonly string[] = ["NA", "EU"];

/** Where a server with no region reported is filed, so it still shows up. */
const NO_REGION = "Other";

export function regionOf(server: PlayerServer): string {
  return server.region || NO_REGION;
}

/**
 * The regions the breakdown gets a column for: the ones the sidecar reports,
 * NA/EU first and the rest alphabetical. Falls back to the known regions when
 * nothing is reported, so an unreachable sidecar leaves an empty breakdown
 * rather than a table with no columns at all.
 */
export function regionsOf(servers: readonly PlayerServer[]): string[] {
  const rank = (region: string) => {
    const index = REGION_ORDER.indexOf(region);
    return index === -1 ? REGION_ORDER.length : index;
  };
  const seen = new Set(servers.map(regionOf));
  if (seen.size === 0) {
    return [...REGION_ORDER];
  }
  return [...seen].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b, "en")
  );
}

// One line of a game variant's table: the mode, and its head count per region.
export interface ModeRow {
  label: string;
  counts: number[];
}

// Get the players count by region for each game mode of specified servers.
export function modeRows(
  servers: readonly PlayerServer[],
  regions: readonly string[]
): ModeRow[] {
  const byMode = new Map<string, number[]>(
    MODE_MATCHERS.map(([, label]): [string, number[]] => [
      label,
      regions.map(() => 0),
    ])
  );

  for (const server of servers) {
    const column = regions.indexOf(regionOf(server));
    // A region outside the columns has nowhere to land; `regions` comes from
    // the same servers, so this only bites a caller that narrowed the list.
    if (column === -1) {
      continue;
    }
    const label = modeLabel(server);
    let counts = byMode.get(label);
    if (!counts) {
      counts = regions.map(() => 0);
      byMode.set(label, counts);
    }
    counts[column] += server.players ?? 0;
  }

  return [...byMode]
    .filter(([, counts]) => counts.some((count) => count > 0))
    .map(([label, counts]) => ({ label, counts }));
}

// The rows each balance's table gets, over the same region columns.
export function modeRowsByVariant(
  servers: readonly PlayerServer[],
  regions: readonly string[]
): Record<GameVariant, ModeRow[]> {
  const rowsFor = (variant: GameVariant) =>
    modeRows(
      servers.filter((s) => variantOf(s) === variant),
      regions
    );
  return {
    ef: rowsFor("ef"),
    classic: rowsFor("classic"),
    playtest: rowsFor("playtest"),
  };
}

// Show the player list. Friends first, alphabetically sorted.
export function rosterOf(
  names: readonly string[],
  isFriend: (player: string) => boolean = () => false
): string[] {
  return [...new Set(names)].sort(
    (a, b) =>
      Number(isFriend(b)) - Number(isFriend(a)) ||
      a.localeCompare(b, "en", { sensitivity: "base" })
  );
}
