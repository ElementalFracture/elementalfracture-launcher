import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AccountModal } from "@/components/modals/AccountModal";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import type { PlayerServer } from "@/lib/rust";
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

export function modeLabel(server: PlayerServer) {
  const serverName = server.display_name || server.name || "";
  for (const [pattern, label] of MODE_MATCHERS) {
    if (pattern.test(serverName)) {
      return label;
    }
  }
  return serverName || "Other";
}

/** How many players are in one mode, and who they are when the sidecar says. */
interface ModePlayers {
  count: number;
  names: string[];
}

/**
 * Roll the sidecar's per-server figures up into per-mode totals, keyed by
 * mode label. Seeded with every known mode so the popover lists them all —
 * an empty mode reads as "No one in game" rather than vanishing. Modes the
 * sidecar reports but MODE_MATCHERS doesn't know are appended after those.
 */
export function playersByMode(servers: readonly PlayerServer[]): Map<string, ModePlayers> {
  const byMode = new Map<string, ModePlayers>(
    MODE_MATCHERS.map(([, label]): [string, ModePlayers] => [label, { count: 0, names: [] }])
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

export function TopBar() {
  const { status } = useGame();
  const { playersData, refreshPlayers } = useLiveData();
  const { settings } = useSettings();
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
  const role = settings?.is_dev ? "Developer" : settings?.is_staff ? "Staff" : "";
  const initials = (name || "EF").slice(0, 2).toUpperCase();

  const inGame = Number.isFinite(playersData?.online) ? (playersData!.online as number) : null;
  const connected = Number.isFinite(playersData?.connected)
    ? (playersData!.connected as number)
    : null;

  const servers = playersData?.servers ?? [];
  const modePlayers = playersByMode(servers);
  const hasServers = servers.length > 0;

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
            <button className="pill clickable" title="Players in game: click for a breakdown">
              <InGameIcon className="pill-icon" />
              <div className="pill-text">
                <strong>{inGame ?? "–"}</strong>
                <small>in game</small>
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="popover-panel" align="end" sideOffset={8}>
            {[...modePlayers].map(([label, players]) => (
              <div key={label}>
                <div className="mode-row">
                  <span>{label}</span>
                  <span className="mode-count">{players.count}</span>
                </div>
                <div className="mode-names">
                  {players.count === 0
                    ? "No one in game"
                    : players.names.length
                      ? players.names.join(", ")
                      : `${players.count} player(s)`}
                </div>
              </div>
            ))}
            {!hasServers && <div className="mode-names">Server data unavailable.</div>}
          </PopoverContent>
        </Popover>

        {registered ? (
          <Popover open={accountPopoverOpen} onOpenChange={setAccountPopoverOpen}>
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
                <span className="avatar">{initials}</span>
                <div className="friend-meta">
                  <strong>{name || "You"}</strong>
                  <small>
                    <span className="status-dot" /> Online
                  </small>
                </div>
              </div>
              <p className="acct-soon">
                Friends are coming soon — you’ll be able to see who’s online and party up right
                here.
              </p>
              <button
                className="acct-link"
                onClick={() => {
                  setAccountPopoverOpen(false);
                  setAccountModalOpen(true);
                }}
              >
                Change token
              </button>
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

      <AccountModal open={accountModalOpen} onOpenChange={setAccountModalOpen} />
    </header>
  );
}
