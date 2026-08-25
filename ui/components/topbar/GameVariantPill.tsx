import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { InfoPopover } from "@/components/InfoPopover";
import { useGame } from "@/context/GameContext";
import { useSettings } from "@/context/SettingsContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import {
  GAME_VARIANTS,
  canSeePlaytest,
  toGameVariant,
  type GameVariant,
} from "@/lib/gameVariant";
import "./GameVariantPill.css";

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
      toast(String(e), true);
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
      return "Enabling…";
    }
    return status?.test_installed ? label : "Enable Playtest";
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
      <Tabs.List className="game-variant-container" aria-label="Game variant">
        <Tabs.Indicator className="fill-selected" />
        {variants.map(({ id, label, title }) => (
          <Tabs.Tab
            key={id}
            value={id}
            className="game-variant-seg"
            title={title}
          >
            {labelFor({ id, label })}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      <InfoPopover label="What's the difference?" align="end">
        <p>
          <strong>Elemental Fracture</strong> is the community edition: reworked
          talents, fresh balance and ongoing updates.
        </p>
        <p>
          <strong>Classic</strong> is Spellbreak as it was at shutdown: the
          original balance, preserved untouched.
        </p>
        {canSeePlaytest(settings) && (
          <p>
            <strong>Playtest</strong> is the private playtest channel:
            unreleased balance for testers to try before it ships.
          </p>
        )}
      </InfoPopover>
    </Tabs.Root>
  );
}
