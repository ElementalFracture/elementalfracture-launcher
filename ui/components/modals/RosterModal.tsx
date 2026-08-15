import { useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { useFriends, type FriendAction } from "@/context/FriendsContext";
import { useSettings } from "@/context/SettingsContext";
import { rosterOf } from "@/components/topbar/players";
import type { Friend, FriendsData } from "@/lib/rust";
import "./RosterModal.css";

// The game mode a roster belongs to
export interface Roster {
  region: string;
  variant: string;
  mode: string;
  names: string[];
}

type Relation = "you" | "friend" | "incoming" | "outgoing";

/**
 * How a listed player already stands with the account — or null when they are
 * a stranger and can be asked. Names come back from the sidecar as typed, so
 * matching is loose.
 */
function relationOf(
  friends: FriendsData | null,
  player: string
): Relation | null {
  const listed = (list?: Friend[]) =>
    list?.some((f) => f.username.toLowerCase() === player.toLowerCase());
  if (friends?.me?.username?.toLowerCase() === player.toLowerCase()) {
    return "you";
  }
  if (listed(friends?.friends)) {
    return "friend";
  }
  if (listed(friends?.incoming)) {
    return "incoming";
  }
  if (listed(friends?.outgoing)) {
    return "outgoing";
  }
  return null;
}

const RELATION_TAGS: Partial<Record<Relation, string>> = {
  you: "you",
  outgoing: "requested",
};

const RELATION_ACTIONS: Partial<Record<Relation, FriendAction>> = {
  incoming: "accept",
};

/** One player in the roster, with the friend request they can be sent. */
function RosterRow({
  player,
  relation,
  canAdd,
}: {
  player: string;
  relation: Relation | null;
  canAdd: boolean;
}) {
  const { runFriendAction } = useFriends();
  const [error, setError] = useState<string | null>(null);
  const action = relation ? RELATION_ACTIONS[relation] : "add";
  const accepting = action === "accept";

  return (
    <li className="roster-row">
      <div className="roster-row-main">
        <span className="roster-name">{player}</span>
        {error && (
          <p className="roster-row-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {action && canAdd ? (
        <button
          className="roster-add"
          title={
            accepting ? "Accept their friend request" : "Send a friend request"
          }
          aria-label={
            accepting
              ? `Accept the friend request from ${player}`
              : `Add ${player} as a friend`
          }
          onClick={async () => setError(await runFriendAction(action, player))}
        >
          <UserPlus aria-hidden="true" />
        </button>
      ) : relation === "friend" ? (
        <UserCheck
          className="roster-friend"
          role="img"
          aria-label={`${player} is your friend`}
        />
      ) : (
        relation &&
        RELATION_TAGS[relation] && (
          <small className="roster-tag">{RELATION_TAGS[relation]}</small>
        )
      )}
    </li>
  );
}

export function RosterModal({
  roster,
  onClose,
}: {
  roster: Roster | null;
  onClose: () => void;
}) {
  const { settings } = useSettings();
  const { friends } = useFriends();

  const canAdd = Boolean(settings?.auth_token?.trim());
  // Read here rather than per row, so the order the roster is listed in and
  // the standing each row shows come off the same reading of the graph.
  const relation = (player: string) => relationOf(friends, player);
  const players = rosterOf(
    roster?.names ?? [],
    (player) => relation(player) === "friend"
  );

  return (
    <Dialog open={roster !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{roster?.mode}</DialogTitle>
          <DialogDescription>
            {roster && `${roster.variant} · ${roster.region}`}
          </DialogDescription>
        </DialogHeader>
        {players.length ? (
          <ul className="roster-list">
            {players.map((player) => (
              <RosterRow
                key={player}
                player={player}
                relation={relation(player)}
                canAdd={canAdd}
              />
            ))}
          </ul>
        ) : (
          <p className="roster-empty">No names reported for this mode.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
