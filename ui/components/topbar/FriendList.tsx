import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import {
  statusRank,
  statusText,
  useFriends,
  type FriendAction,
} from "@/context/FriendsContext";
import type { FriendStatus } from "@/lib/rust";
import "./FriendList.css";

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
export function FriendList() {
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
        <Button variant="secondary" title="Send friend request" onClick={onAdd}>
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
