import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AccountModal } from "@/components/modals/AccountModal";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import {
  statusRank,
  statusText,
  useFriends,
  type FriendAction,
} from "@/context/FriendsContext";
import type { FriendStatus, PlayerServer } from "@/lib/rust";
import { useSettings } from "@/context/SettingsContext";
import logoFull from "@/assets/logo-full.png";
import { PlayersIcon } from "@/assets/icons/PlayersIcon";
import { InGameIcon } from "@/assets/icons/InGameIcon";
import "./TopBar.css";

/** Server-name pattern → the mode bucket it belongs in. */
const MODE_MATCHERS: readonly (readonly [RegExp, string])[] = [
  [/solo/i, "Solos"],
  [/duo/i, "Duos"],
  [/squad/i, "Squads"],
  [/arena|tdm|capture/i, "Arena/TDM"],
];

/** The two balance variants, in the order the breakdown lists them. */
const VARIANTS: readonly (readonly [GameVariant, string])[] = [
  ["ef", "Elemental Fracture"],
  ["classic", "Classic"],
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
interface ModePlayers {
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

/** One friend/request line: presence dot, name, and its actions. */
function FriendRow({
  username,
  status,
  pending,
  actions,
}: {
  username: string;
  status?: FriendStatus;
  pending?: boolean;
  actions: {
    label: string;
    title: string;
    action: FriendAction;
    kind: "ok" | "no";
  }[];
}) {
  const { runFriendAction } = useFriends();
  return (
    <div className="friend-row">
      <span className="status-dot" data-status={status} />
      <div className="friend-row-meta">
        <strong>{username}</strong>
        {/* TODO verify if status is correct.
          I see online player in friend list but not in Online container
        */}
        {status && <small>{statusText(status)}</small>}
        {pending && <small className="friend-pending">requested</small>}
      </div>
      <div className="friend-row-actions">
        {actions.map((a) => (
          <button
            key={a.action}
            className={a.kind}
            title={a.title}
            onClick={() => runFriendAction(a.action, username)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Add-friend box, incoming requests, then the friend list itself. */
function FriendList() {
  const { friends, runFriendAction } = useFriends();
  const [addName, setAddName] = useState("");

  const onAdd = () => {
    const name = addName.trim();
    if (!name) {
      return;
    }
    setAddName("");
    runFriendAction("add", name);
  };

  const incoming = friends?.incoming ?? [];
  const outgoing = friends?.outgoing ?? [];
  const accepted = [...(friends?.friends ?? [])].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status)
  );

  return (
    <>
      <div className="friend-add">
        <Input
          type="text"
          maxLength={20}
          spellCheck={false}
          autoComplete="off"
          placeholder="Add a friend by username"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <Button
          variant="secondary"
          title="Send friend request"
          onClick={onAdd}
        >
          Add
        </Button>
      </div>

      {!friends ? (
        <p className="friend-empty">Loading…</p>
      ) : (
        <>
          {incoming.length > 0 && (
            <div id="friend-requests">
              <div className="friend-subhead">Requests ({incoming.length})</div>
              {incoming.map((r) => (
                <FriendRow
                  key={r.username}
                  username={r.username}
                  actions={[
                    {
                      label: "✓",
                      title: "Accept",
                      action: "accept",
                      kind: "ok",
                    },
                    {
                      label: "✕",
                      title: "Decline",
                      action: "remove",
                      kind: "no",
                    },
                  ]}
                />
              ))}
            </div>
          )}

          <div id="friend-list">
            <div className="friend-subhead">Friends ({accepted.length})</div>
            {accepted.length === 0 && outgoing.length === 0 && (
              <p className="friend-empty">
                No friends yet, add someone by their username above.
              </p>
            )}
            {accepted.map((f) => (
              <FriendRow
                key={f.username}
                username={f.username}
                status={f.status ?? "offline"}
                actions={[
                  {
                    label: "✕",
                    title: "Remove friend",
                    action: "remove",
                    kind: "no",
                  },
                ]}
              />
            ))}
            {outgoing.map((o) => (
              <FriendRow
                key={o.username}
                username={o.username}
                pending
                actions={[
                  {
                    label: "✕",
                    title: "Cancel request",
                    action: "remove",
                    kind: "no",
                  },
                ]}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function TopBar() {
  const { status } = useGame();
  const { playersData, refreshPlayers } = useLiveData();
  const { settings } = useSettings();
  const { friends, refreshFriends } = useFriends();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);

  const installed = Boolean(status?.exe_present);
  const dotClass = !status?.game_path || !installed ? "dot" : "dot ok";
  const stateText = !status?.game_path
    ? "Not installed"
    : !installed
      ? "Not found"
      : status.local_version
        ? `v${status.local_version}`
        : "Installed";

  const registered = Boolean(settings?.auth_token?.trim());
  const name = settings?.username?.trim();
  const role = settings?.is_dev
    ? "Developer"
    : settings?.is_staff
      ? "Staff"
      : "";
  const initials = (name || "EF").slice(0, 2).toUpperCase();

  const selfName = friends?.me?.username || name || "You";
  const selfInitials = selfName.slice(0, 2).toUpperCase();
  const selfStatus = friends?.me?.status ?? "online";

  const inGame = Number.isFinite(playersData?.online)
    ? (playersData!.online as number)
    : null;
  const connected = Number.isFinite(playersData?.connected)
    ? (playersData!.connected as number)
    : null;

  const servers = playersData?.servers ?? [];
  const byVariant = playersByVariant(servers);
  const multiRegion = hasMultipleRegions(servers);

  return (
    <header id="topbar">
      <img src={logoFull} alt="Elemental Fracture" id="topbar-logo" />
      <div className="top-pills">
        <div className="pill">
          <span className={dotClass} />
          <div className="pill-text">
            <strong>Spellbreak</strong>
            <small>{stateText}</small>
          </div>
        </div>

        <div className="pill" title="Players connected to the server">
          <PlayersIcon className="pill-icon" />
          <div className="pill-text">
            <strong>{connected ?? inGame ?? "–"}</strong>
            <small>online</small>
          </div>
        </div>

        {/* Refresh players on open, mak sure to have up-to-date data. */}
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
          <PopoverContent className="popover-panel" align="end" sideOffset={8}>
            {/* One heading per balance, each followed by its four mode rows
                (idle ones included, so the shape stays stable). The roster
                line only appears for a populated mode, keeping the two
                sections compact. */}
            {VARIANTS.map(([variant, variantLabel]) => (
              <div key={variant}>
                <div className="variant-head">{variantLabel}</div>
                {[...byVariant[variant]].map(([label, players]) => {
                  const split =
                    multiRegion && players.count > 0
                      ? regionSplit(players)
                      : "";
                  return (
                    <div key={label}>
                      <div className="mode-row">
                        <span>{label}</span>
                        <span className="mode-count">
                          {split
                            ? `${players.count} (${split})`
                            : players.count}
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

        {registered ? (
          <Popover
            open={accountPopoverOpen}
            onOpenChange={(open) => {
              setAccountPopoverOpen(open);
              if (open) {
                refreshFriends();
              }
            }}
          >
            <PopoverTrigger asChild>
              <button className="pill account" title="Account">
                <span className="avatar">{initials}</span>
                <div className="pill-text">
                  <strong>{name || "Guest"}</strong>
                  {role && <small>{role}</small>}
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="popover-panel account-popover-panel"
              align="end"
              sideOffset={8}
            >
              <div className="acct-head">Friend List</div>
              <div className="friend-self">
                <span className="avatar">{selfInitials}</span>
                <div className="friend-meta">
                  <strong>{selfName}</strong>
                  <small>
                    <span className="status-dot" data-status={selfStatus} />{" "}
                    {statusText(selfStatus)}
                  </small>
                </div>
              </div>
              <FriendList />
              <Button
                variant="secondary"
                className="acct-link"
                onClick={() => {
                  setAccountPopoverOpen(false);
                  setAccountModalOpen(true);
                }}
              >
                Change token
              </Button>
            </PopoverContent>
          </Popover>
        ) : (
          <button
            className="pill account"
            title="Account"
            onClick={() => setAccountModalOpen(true)}
          >
            <span className="avatar">{initials}</span>
            <div className="pill-text">
              <strong>Guest</strong>
              <small>No token set</small>
            </div>
          </button>
        )}
      </div>

      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
      />
    </header>
  );
}
