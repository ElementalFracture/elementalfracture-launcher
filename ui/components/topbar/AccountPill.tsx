import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import { AccountModal } from "@/components/modals/AccountModal";
import { statusText, useFriends } from "@/context/FriendsContext";
import { useSettings } from "@/context/SettingsContext";
import { FriendList } from "./FriendList";
import "./AccountPill.css";

/**
 * The account pill. With a token set it opens the friend list; without one it
 * goes straight to the token modal, since there is no account to show yet.
 */
export function AccountPill() {
  const { settings } = useSettings();
  const { friends, refreshFriends } = useFriends();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountPopoverOpen, setAccountPopoverOpen] = useState(false);

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

  return (
    <>
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
            className="account-popover-panel"
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

      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
      />
    </>
  );
}
