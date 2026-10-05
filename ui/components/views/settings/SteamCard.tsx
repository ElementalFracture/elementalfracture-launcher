import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Switch } from "@/components/shadcn/switch";
import { InfoPopover } from "@/components/InfoPopover";
import { useSettings } from "@/context/SettingsContext";
import { useUI } from "@/context/UIContext";
import type { SteamStatus } from "@/generated/bindings";
import { isWindows } from "@/lib/platform";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import { toastError } from "@/i18n/errors";
import { _, type Key } from "@/i18n";
import type { SettingsForm } from "./useSettingsForm";

/** How often Steam is re-read while Settings is open. Closing Steam or
    installing Spellbreak happens outside the launcher, and the switches
    should follow without a trip away and back. */
const POLL_MS = 3000;

/** Link Spellbreak's Play button to the launcher, or add the launcher to
    Steam as a shortcut. Hidden when there's no Steam to wire into. */
export function SteamCard({ form }: { form: SettingsForm }) {
  const { view } = useUI();
  const active = view === "settings";
  const [status, setStatus] = useState<SteamStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const { refreshSettings } = useSettings();

  const refresh = useCallback(async () => {
    try {
      setStatus(await rust.steamStatus());
    } catch {
      // Keep showing the last answer; the next poll tries again.
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!active) {
      return;
    }
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [active, refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!status?.found) {
    return null;
  }

  const change = async (apply: () => Promise<SteamStatus>, done: Key) => {
    setBusy(true);
    try {
      setStatus(await apply());
      toast(_(done));
    } catch (e) {
      toastError(e);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const onCloseSteam = async () => {
    try {
      await rust.steamShutdown();
      toast(_("settings.steam.closing"));
    } catch (e) {
      toastError(e);
    }
  };

  const locked = busy || status.running || !status.has_user;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{_("settings.steam.title")}</CardTitle>
        {status.running && (
          <CardAction className="panel-actions">
            <Button variant="secondary" onClick={onCloseSteam}>
              {_("settings.steam.closeSteam")}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="switch-list">
        {status.running ? (
          <p className="card-note">{_("settings.steam.closeFirst")}</p>
        ) : (
          !status.has_user && (
            <p className="card-note">
              {_("settings.steam.noUser")}
              {status.root && (
                <span className="card-note-path"> ({status.root})</span>
              )}
            </p>
          )
        )}
        <div className="switch-row">
          <span className="switch-text">
            <span>{_("settings.steam.link")}</span>
            <InfoPopover>
              <p>{_("settings.steam.linkHelp")}</p>
              {!status.spellbreak_installed && (
                <p>{_("settings.steam.linkUnavailable")}</p>
              )}
            </InfoPopover>
          </span>
          <Switch
            aria-label={_("settings.steam.link")}
            checked={status.linked}
            disabled={
              locked || (!status.linked && !status.spellbreak_installed)
            }
            onCheckedChange={(on) =>
              change(
                () => rust.steamSetLinked(on),
                on ? "settings.steam.linked" : "settings.steam.unlinked"
              )
            }
          />
        </div>
        {/* Only means anything once Steam's Play leads here. */}
        {status.linked && (
          <div className="switch-row">
            <span className="switch-text">
              <span>{_("settings.steam.quickstart")}</span>
              <InfoPopover>
                <p>{_("settings.steam.quickstartHelp")}</p>
              </InfoPopover>
            </span>
            <Switch
              aria-label={_("settings.steam.quickstart")}
              checked={form.steamQuickstart}
              onCheckedChange={form.setSteamQuickstart}
            />
          </div>
        )}
        <div className="switch-row">
          <span className="switch-text">
            <span>{_("settings.steam.shortcut")}</span>
            <InfoPopover>
              <p>{_("settings.steam.shortcutHelp")}</p>
              {!isWindows && <p>{_("settings.steam.shortcutLinux")}</p>}
            </InfoPopover>
          </span>
          <Switch
            aria-label={_("settings.steam.shortcut")}
            checked={status.shortcut}
            disabled={locked}
            onCheckedChange={async (on) => {
              await change(
                () => rust.steamSetShortcut(on),
                on ? "settings.steam.added" : "settings.steam.removed"
              );
              /* On Linux the shortcut is the game, and adding it switches
                 the launch wrapper to Steam; removing it puts a Play that
                 was starting it back on the default wrapper. */
              refreshSettings();
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
