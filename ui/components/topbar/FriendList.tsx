import { useCallback, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/shadcn/accordion";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import {
  statusRank,
  getStatusText,
  useFriends,
  type FriendAction,
} from "@/context/FriendsContext";
import type { FriendStatus } from "@/lib/rust";
import { _, type Key } from "@/i18n";
import "./FriendList.css";

interface RowAction {
  label: string;
  title: Key;
  action: FriendAction;
  kind: "ok" | "no";
  /** Ask before firing. Only unfriending does — declining or cancelling a
   *  request costs nothing to redo, but a friendship has to be asked for
   *  again from the other side. */
  confirm?: boolean;
}

const FRIEND_ACTIONS: RowAction[] = [
  {
    label: "✕",
    title: "friends.remove",
    action: "remove",
    kind: "no",
    confirm: true,
  },
];
const INCOMING_ACTIONS: RowAction[] = [
  { label: "✓", title: "friends.accept", action: "accept", kind: "ok" },
  { label: "✕", title: "friends.decline", action: "remove", kind: "no" },
];
const OUTGOING_ACTIONS: RowAction[] = [
  { label: "✕", title: "friends.cancelRequest", action: "remove", kind: "no" },
];

/** One friend/request line: presence dot, name, and its actions. */
function FriendRow({
  username,
  status,
  pending,
  actions,
  error,
  onError,
  onConfirm,
}: {
  username: string;
  status?: FriendStatus;
  pending?: boolean;
  actions: RowAction[];
  error?: string;
  onError: (username: string, message: string | null) => void;
  onConfirm?: (username: string) => void;
}) {
  const { runFriendAction } = useFriends();
  return (
    <div className="friend-row">
      <span className="status-dot" data-status={status} />
      <div className="friend-row-main">
        <div className="friend-row-meta">
          <span className="friend-row-name">
            <strong>{username}</strong>
            {/* TODO verify if status is correct.
          I see online player in friend list but not in Online container
        */}
            {status === "in_game" && <small>{getStatusText(status)}</small>}
            {pending && (
              <small className="friend-pending">{_("friends.requested")}</small>
            )}
          </span>
        </div>
        {error && (
          <p className="friend-row-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="friend-row-actions">
        {actions.map((a) => (
          <button
            key={a.action}
            className={a.kind}
            title={_(a.title)}
            aria-label={_("friends.actionFor", {
              action: _(a.title),
              name: username,
            })}
            onClick={async () => {
              if (a.confirm && onConfirm) {
                onConfirm(username);
                return;
              }
              // Null on success, which clears whatever was there before.
              onError(username, await runFriendAction(a.action, username));
            }}
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
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [addFriendError, setAddFriendError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const setRowError = useCallback(
    (username: string, message: string | null) => {
      setRowErrors((prev) => {
        const next = { ...prev };
        if (message) {
          next[username] = message;
        } else {
          delete next[username];
        }
        return next;
      });
    },
    []
  );

  const onAdd = async () => {
    const name = addName;
    if (!name) {
      return;
    }
    // Nothing to say when it works: the request shows up in the list below.
    const error = await runFriendAction("add", name);
    setAddFriendError(error);
    if (!error) {
      setAddName("");
    }
  };

  const incoming = friends?.incoming ?? [];
  const outgoing = friends?.outgoing ?? [];
  const accepted = friends?.friends ?? [];
  // In-game first, then online; the offline ones get their own section below.
  const online = accepted
    .filter((f) => f.status && f.status !== "offline")
    .sort((a, b) => statusRank(a.status) - statusRank(b.status));
  const offline = accepted.filter((f) => !f.status || f.status === "offline");
  const pending = incoming.length + outgoing.length;

  return (
    <>
      <div className="friend-add">
        <Input
          type="text"
          maxLength={25}
          spellCheck={false}
          autoComplete="off"
          placeholder={_("friends.addPlaceholder")}
          value={addName}
          aria-invalid={addFriendError !== null}
          aria-describedby={addFriendError ? "friend-add-error" : undefined}
          onChange={(e) => {
            setAddName(e.target.value);
            setAddFriendError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <Button
          variant="secondary"
          title={_("friends.addTitle")}
          onClick={onAdd}
        >
          {_("friends.add")}
        </Button>
      </div>
      {addFriendError && (
        <p className="friend-add-error" id="friend-add-error" role="alert">
          {addFriendError}
        </p>
      )}

      {!friends ? (
        <p className="friend-empty">{_("friends.loading")}</p>
      ) : accepted.length === 0 && pending === 0 ? (
        <p className="friend-empty">{_("friends.none")}</p>
      ) : (
        /* Everything but the offline crowd starts open — that section is the
           long one and the least worth scrolling past. */
        <Accordion
          className="friend-accordion"
          multiple
          defaultValue={["friends", "requests"]}
        >
          <AccordionItem value="friends">
            <AccordionTrigger>
              {_("friends.onlineSection", { n: online.length })}
            </AccordionTrigger>
            <AccordionContent>
              {online.length === 0 ? (
                <p className="friend-empty">{_("friends.onlineEmpty")}</p>
              ) : (
                online.map((f) => (
                  <FriendRow
                    key={f.username}
                    username={f.username}
                    status={f.status ?? "offline"}
                    actions={FRIEND_ACTIONS}
                    error={rowErrors[f.username]}
                    onError={setRowError}
                    onConfirm={setUserToRemove}
                  />
                ))
              )}
            </AccordionContent>
          </AccordionItem>

          {pending > 0 && (
            <AccordionItem value="requests">
              <AccordionTrigger>
                {_("friends.requestsSection", { n: pending })}
              </AccordionTrigger>
              <AccordionContent>
                {incoming.map((r) => (
                  <FriendRow
                    key={r.username}
                    username={r.username}
                    actions={INCOMING_ACTIONS}
                    error={rowErrors[r.username]}
                    onError={setRowError}
                  />
                ))}
                {outgoing.map((o) => (
                  <FriendRow
                    key={o.username}
                    username={o.username}
                    pending
                    actions={OUTGOING_ACTIONS}
                    error={rowErrors[o.username]}
                    onError={setRowError}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          )}

          <AccordionItem value="offline">
            <AccordionTrigger>
              {_("friends.offlineSection", { n: offline.length })}
            </AccordionTrigger>
            <AccordionContent>
              {offline.length === 0 ? (
                <p className="friend-empty">{_("friends.offlineEmpty")}</p>
              ) : (
                offline.map((f) => (
                  <FriendRow
                    key={f.username}
                    username={f.username}
                    status="offline"
                    actions={FRIEND_ACTIONS}
                    error={rowErrors[f.username]}
                    onError={setRowError}
                    onConfirm={setUserToRemove}
                  />
                ))
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* One dialog for the whole list rather than one per row — only ever a
          single pending removal, named by `userToRemove`. */}
      <Dialog
        open={userToRemove !== null}
        onOpenChange={(next) => !next && setUserToRemove(null)}
      >
        <DialogContent
          className="wizard-panel"
          showCloseButton={false}
          showOverlay={false}
        >
          <div className="wizard-step">
            <h2>{_("friends.confirmTitle", { name: userToRemove ?? "" })}</h2>
            <p className="muted">
              {_("friends.confirmBody", { name: userToRemove ?? "" })}
            </p>
            <div className="wizard-actions">
              <Button variant="secondary" onClick={() => setUserToRemove(null)}>
                {_("friends.confirmCancel")}
              </Button>
              <Button
                onClick={async () => {
                  const name = userToRemove ?? "";
                  setUserToRemove(null);
                  setRowError(name, await runFriendAction("remove", name));
                }}
              >
                {_("friends.confirmRemove")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
