import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/shadcn/drawer";
import { Separator } from "@/components/shadcn/separator";
import { AccountModal } from "@/components/modals/AccountModal";
import { useFriends } from "@/context/FriendsContext";
import { useSettings } from "@/context/SettingsContext";
import { avatarUrl } from "@/lib/avatar";
import { toast } from "@/lib/toast";
import { toastError } from "@/i18n/errors";
import { _ } from "@/i18n";
import { FriendList } from "./FriendList";
import "./AccountPill.css";

/** Avatar image when one is set, else the initials fallback. */
function Avatar({ url, initials }: { url: string | null; initials: string }) {
  return (
    <span className="avatar">
      {url ? <img src={url} alt="" draggable={false} /> : initials}
    </span>
  );
}

/**
 * With a verified account it opens the friend list in a drawer off the right
 * edge; otherwise it goes straight to the token modal, since there is no
 * account to show yet.
 */
export function AccountPill() {
  const { settings, logout } = useSettings();
  const { friends, refreshFriends } = useFriends();
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  const avUrl = avatarUrl(settings);

  const signOut = async () => {
    try {
      await logout();
      setAccountDrawerOpen(false);
      toast(_("topbar.account.signedOut"));
    } catch (e) {
      toastError(e);
    }
  };

  const name = settings?.username?.trim();
  /* A stored token is not an account: a token can be on disk (from a past
     sign-in) while the last role refresh cleared the name, so the name, not the
     token, is what proves a verified account. */
  const hasToken = Boolean(settings?.auth_token?.trim());
  const registered = Boolean(name);
  const role = settings?.is_dev
    ? _("topbar.account.developer")
    : settings?.is_staff
      ? _("topbar.account.staff")
      : settings?.is_tester
        ? _("topbar.account.tester")
        : "";
  const initials = (name || "EF").slice(0, 2).toUpperCase();

  const selfName = friends?.me?.username || name || _("topbar.account.you");
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
          <DrawerTrigger
            className="pill account"
            title={_("topbar.account.title")}
          >
            <Avatar url={avUrl} initials={initials} />
            <div className="pill-text">
              <strong>{name || _("topbar.account.guest")}</strong>
              {role && <small>{role}</small>}
            </div>
          </DrawerTrigger>

          <DrawerContent className="account-drawer">
            <DrawerHeader className="account-drawer-head">
              <div className="friend-self">
                <Avatar url={avUrl} initials={selfInitials} />
                <div className="friend-meta">
                  <strong>{selfName}</strong>
                  {role && <small>{role}</small>}
                </div>
              </div>
              <DrawerClose
                render={<Button variant="ghost" size="icon-sm" />}
                aria-label={_("topbar.account.closeFriends")}
              >
                <ArrowRight aria-hidden="true" />
              </DrawerClose>
            </DrawerHeader>

            <div className="account-drawer-body">
              <Separator />
              <FriendList />
            </div>

            <div className="account-drawer-foot">
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="account-signout"
                onClick={signOut}
              >
                {_("topbar.account.signOut")}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <button
          className="pill account"
          title={_("topbar.account.title")}
          onClick={() => setAccountModalOpen(true)}
        >
          <span className="avatar">{initials}</span>
          <div className="pill-text">
            <strong>{_("topbar.account.guest")}</strong>
            <small>
              {hasToken
                ? _("topbar.account.sessionExpired")
                : _("topbar.account.signIn")}
            </small>
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
