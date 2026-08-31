import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as rust from "@/lib/rust";
import type { FriendStatus, FriendsData } from "@/lib/rust";
import { useSettings } from "@/context/SettingsContext";
import { errorText } from "@/i18n/errors";

/** Error codes the sidecar answers with, in the wording the popover shows. */
const FRIEND_ERRORS: Record<string, string> = {
  user_not_found: "No player with that Spellbreak ID.",
  cannot_friend_self: "That's you!",
  invalid_token: "Set your account token first.",
  username_required: "Enter a Spellbreak ID.",
  no_pending_request: "No pending request from them.",
};

export function friendError(code?: string) {
  return (
    (code && FRIEND_ERRORS[code]) || "Friend server unavailable, try again."
  );
}

export function getStatusText(status?: FriendStatus) {
  return status === "in_game"
    ? "in game"
    : status === "online"
      ? "online"
      : "offline";
}

/** In-game first, then online, then offline. The sidecar pre-sorts by name,
 *  so equal ranks keep that order. */
export function statusRank(status?: FriendStatus) {
  return status === "in_game" ? 0 : status === "online" ? 1 : 2;
}

export type FriendAction = "add" | "accept" | "remove";

interface FriendsContextValue {
  /** Null until the first successful fetch — the popover shows "Loading…". */
  friends: FriendsData | null;
  refreshFriends: () => Promise<void>;
  /** Resolves to null when the action went through, or to the wording to put
   *  in front of the player when it didn't. */
  runFriendAction: (
    action: FriendAction,
    username: string
  ) => Promise<string | null>;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [friends, setFriends] = useState<FriendsData | null>(null);

  // Every call needs a token, so a guest never reaches the sidecar at all.
  // Keyed on the value rather than the settings object: re-reading settings
  // for an unrelated field must not tear down the heartbeat below.
  const token = settings?.auth_token?.trim() ?? "";

  const refreshFriends = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const data = await rust.friendsList();
      if (data?.ok) {
        setFriends(data);
      }
    } catch {
      /* server unreachable — keep the last-known list rather than blanking it */
    }
  }, [token]);

  /* Nothing is announced from here. Every failure goes back to the caller as
     wording to render. */
  const runFriendAction = useCallback(
    async (action: FriendAction, username: string): Promise<string | null> => {
      try {
        const res =
          action === "accept"
            ? await rust.friendAccept(username)
            : action === "add"
              ? await rust.friendAdd(username)
              : await rust.friendRemove(username);
        if (!res?.ok) {
          return friendError(res?.error);
        }
        await refreshFriends();
        return null;
      } catch (e) {
        return errorText(e);
      }
    },
    [refreshFriends]
  );

  /* A new token is a new identity: drop the previous account's graph before
     pulling the new one, so no one else's friends flash up in between. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setFriends(null);
    if (!token) {
      return;
    }
    refreshFriends();
    // Also the presence heartbeat: polling /friends is what marks the account
    // online for as long as the launcher stays open.
    const id = setInterval(refreshFriends, 60_000);
    return () => clearInterval(id);
  }, [token, refreshFriends]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const value: FriendsContextValue = {
    friends,
    refreshFriends,
    runFriendAction,
  };
  return (
    <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>
  );
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) {
    throw new Error("useFriends must be used within a FriendsProvider");
  }
  return ctx;
}
