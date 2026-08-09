import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/shadcn/drawer";
import { Separator } from "@/components/shadcn/separator";
import { AccountModal } from "@/components/modals/AccountModal";
import { useFriends } from "@/context/FriendsContext";
import { useSettings } from "@/context/SettingsContext";
import { FriendList } from "./FriendList";
import "./AccountPill.css";

/**
 * With a token set it opens the friend list in a drawer off
 * the right edge; without one it goes straight to the token modal, since there
 * is no account to show yet.
 */
export function AccountPill() {
  const { settings } = useSettings();
  const { friends, refreshFriends } = useFriends();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);

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

  return (
    <>
      {registered ? (
        <Drawer
          open={accountDrawerOpen}
          modal={false}
          swipeDirection="right"
          onOpenChange={(open) => {
            setAccountDrawerOpen(open);
            if (open) {
              refreshFriends();
            }
          }}
        >
          <DrawerTrigger className="pill account" title="Account">
            <span className="avatar">{initials}</span>
            <div className="pill-text">
              <strong>{name || "Guest"}</strong>
              {role && <small>{role}</small>}
            </div>
          </DrawerTrigger>

          <DrawerContent className="account-drawer">
            <DrawerHeader className="account-drawer-head">
              <div className="friend-self">
                <span className="avatar">{selfInitials}</span>
                <div className="friend-meta">
                  <strong>{selfName}</strong>
                </div>
              </div>
              <DrawerClose
                render={<Button variant="ghost" size="icon-sm" />}
                aria-label="Close friend list"
              >
                <ArrowRight aria-hidden="true" />
              </DrawerClose>
            </DrawerHeader>

            <div className="account-drawer-body">
              <Separator />
              <FriendList />
            </div>

            <DrawerFooter>
              <Button
                variant="secondary"
                className="acct-link"
                onClick={() => {
                  setAccountDrawerOpen(false);
                  setAccountModalOpen(true);
                }}
              >
                Change token
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
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
