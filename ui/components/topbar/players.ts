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

/** Regions the split leads with, in order; anything else trails them. */
const REGION_ORDER: readonly string[] = ["NA", "EU"];

/** How many players are in one mode, who they are, and where they're playing. */
export interface ModePlayers {
  count: number;
  names: string[];
  byRegion: Map<string, number>;
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
      { count: 0, names: [], byRegion: new Map() },
    ])
  );

  for (const server of servers) {
    const label = modeLabel(server);
    let players = byMode.get(label);
    if (!players) {
      players = { count: 0, names: [], byRegion: new Map() };
      byMode.set(label, players);
    }
    const count = server.players ?? 0;
    players.count += count;
    if (Array.isArray(server.names)) {
      players.names.push(...server.names);
    }
    if (server.region) {
      players.byRegion.set(
        server.region,
        (players.byRegion.get(server.region) ?? 0) + count
      );
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

/**
 * One mode's per-region breakdown, e.g. "NA 12 · EU 4". Regions nobody is in
 * are left out, so an empty EU doesn't pad every row.
 */
export function regionSplit(players: ModePlayers): string {
  const rank = (region: string) => {
    const index = REGION_ORDER.indexOf(region);
    return index === -1 ? REGION_ORDER.length : index;
  };
  return [...players.byRegion]
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([region, count]) => `${region} ${count}`)
    .join(" · ");
}

/**
 * Whether a second region is actually reporting. Until the peer merge is live
 * only NA answers, and a split would just restate each mode's total — so the
 * popover holds it back and stays clean.
 */
export function hasMultipleRegions(servers: readonly PlayerServer[]): boolean {
  let seen: string | undefined;
  for (const server of servers) {
    if (!server.region) {
      continue;
    }
    if (seen && server.region !== seen) {
      return true;
    }
    seen = server.region;
  }
  return false;
}
