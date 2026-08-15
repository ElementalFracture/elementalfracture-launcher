import type { PlayerServer } from "@/lib/rust";

/** Server-name pattern → the mode bucket it belongs in. */
const MODE_MATCHERS: readonly (readonly [RegExp, string])[] = [
  [/solo/i, "Solos"],
  [/duo/i, "Duos"],
  [/squad/i, "Squads"],
  [/arena|tdm|capture/i, "Arena/TDM"],
];

export type GameVariant = "ef" | "classic";

/**
 * Which balance a server runs. Classic servers are the manager's dynamic
 * vanilla groups: container name vsolo/vduos/… and display "Classic <Mode> N".
 * Anything else is an Elemental Fracture server.
 */
export function variantOf(server: PlayerServer): GameVariant {
  return /^v(solo|duo|squad|arena)/i.test(server.name || "") ||
    /^classic\b/i.test(server.display_name || "")
    ? "classic"
    : "ef";
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
 * The regions the breakdown gets a tab for: the ones the sidecar reports,
 * NA/EU first and the rest alphabetical. Falls back to the known regions when
 * nothing is reported, so an unreachable sidecar leaves an empty breakdown
 * rather than no tabs at all.
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

/** How many players are in one mode, and who they are. */
export interface ModePlayers {
  count: number;
  names: string[];
}

/**
 * Roll the sidecar's per-server figures up into per-mode totals, keyed by
 * mode label. Seeded with every known mode so the popover lists them all —
 * an empty mode reads as "No one in game" rather than vanishing. Modes the
 * sidecar reports but MODE_MATCHERS doesn't know are appended after those.
 */
export function playersByMode(
  servers: readonly PlayerServer[]
): Map<string, ModePlayers> {
  const byMode = new Map<string, ModePlayers>(
    MODE_MATCHERS.map(([, label]): [string, ModePlayers] => [
      label,
      { count: 0, names: [] },
    ])
  );

  for (const server of servers) {
    const label = modeLabel(server);
    let players = byMode.get(label);
    if (!players) {
      players = { count: 0, names: [] };
      byMode.set(label, players);
    }
    players.count += server.players ?? 0;
    if (Array.isArray(server.names)) {
      players.names.push(...server.names);
    }
  }

  return byMode;
}

/**
 * The same roll-up, split into the two balance variants the breakdown lists
 * separately. Each side is seeded with every known mode, so both sections keep
 * the same four rows whether or not anyone is playing that balance.
 */
export function playersByVariant(
  servers: readonly PlayerServer[]
): Record<GameVariant, Map<string, ModePlayers>> {
  return {
    ef: playersByMode(servers.filter((s) => variantOf(s) === "ef")),
    classic: playersByMode(servers.filter((s) => variantOf(s) === "classic")),
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

/** Everyone across one game variant: the figure on its section head. */
export function variantTotal(byMode: Map<string, ModePlayers>): number {
  let total = 0;
  for (const players of byMode.values()) {
    total += players.count;
  }
  return total;
}

/** Everyone in one region, both game variant together: the figure on its tab. */
export function totalPlayers(
  byVariant: Record<GameVariant, Map<string, ModePlayers>>
): number {
  return Object.values(byVariant).reduce(
    (total, byMode) => total + variantTotal(byMode),
    0
  );
}

export function playersByRegion(
  servers: readonly PlayerServer[]
): Map<string, Record<GameVariant, Map<string, ModePlayers>>> {
  return new Map(
    regionsOf(servers).map((region) => [
      region,
      playersByVariant(servers.filter((s) => regionOf(s) === region)),
    ])
  );
}
