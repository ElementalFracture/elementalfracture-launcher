import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { InfoPopover } from "@/components/InfoPopover";
import { useGame } from "@/context/GameContext";
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { toastError } from "@/i18n/errors";
import { _ } from "@/i18n";
import {
  GAME_VARIANTS,
  canSeePlaytest,
  toGameVariant,
  type GameVariant,
} from "@/lib/gameVariant";
import "./GameVariantPill.css";

/* Retrieve text between '*' and apply style to it */
function Marked({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\*([^*]+)\*/)
        .map((part, i) =>
          i % 2 === 1 ? <strong key={i}>{part}</strong> : part
        )}
    </>
  );
}

export function GameVariantPill() {
  const { status, refreshStatus } = useGame();
  const { settings } = useSettings();
  const [installing, setInstalling] = useState(false);

  const activeGameVariant = toGameVariant(status?.variant);
  // The playtest channel is invisible to accounts without the badge — devs
  // included, since they hold it implicitly. Never a disabled tab: an option
  // nobody outside the playtest can take is better left unsaid.
  const variants = GAME_VARIANTS.filter(
    (v) => !v.testersOnly || canSeePlaytest(settings)
  );

  const onGameVariant = async (picked: GameVariant | null) => {
    if (!picked || picked === activeGameVariant || installing) {
      return;
    }
    try {
      // First time on this machine there is no pak to switch to, so the
      // channel is downloaded and switched onto in one go; the shared install
      // progress bar carries it (download-playtest / extract-playtest).
      if (picked === "playtest" && !status?.test_installed) {
        setInstalling(true);
        await rust.installPlaytestBuild();
      } else {
        await rust.setVariant(picked);
      }
    } catch (e) {
      toastError(e);
    } finally {
      setInstalling(false);
    }
    refreshStatus();
  };

  if (!status?.exe_present) {
    return null;
  }

  /* What the playtest tab says depends on whether its pak is on disk:
     pressing it either switches balance or pulls it down first. */
  const labelFor = ({ id, label }: { id: GameVariant; label: string }) => {
    if (id !== "playtest") {
      return label;
    }
    if (installing) {
      return _("topbar.variant.enabling");
    }
    return status?.test_installed ? label : _("topbar.variant.enable");
  };

  return (
    /*
     * Tabs is used as a toggle as it's the best component that fit requirements:
     * Having elements of different width and don't need to manage their width
     * in this component to change the fill-selected side.
     */
    <Tabs.Root
      className="pill game-variant"
      value={activeGameVariant}
      onValueChange={onGameVariant}
    >
      <Tabs.List
        className="game-variant-container"
        aria-label={_("topbar.variant.group")}
      >
        <Tabs.Indicator className="fill-selected" />
        {variants.map(({ id, label, title }) => (
          <Tabs.Tab
            key={id}
            value={id}
            className="game-variant-seg"
            title={_(title)}
          >
            {labelFor({ id, label })}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <InfoPopover label={_("topbar.variant.difference")} align="end">
        <p>
          <Marked text={_("topbar.variant.efHelp")} />
        </p>
        <p>
          <Marked text={_("topbar.variant.classicHelp")} />
        </p>
        {canSeePlaytest(settings) && (
          <p>
            <Marked text={_("topbar.variant.playtestHelp")} />
          </p>
        )}
      </InfoPopover>
    </Tabs.Root>
  );
}
