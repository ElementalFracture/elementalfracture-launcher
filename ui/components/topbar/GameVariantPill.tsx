import { Tabs } from "@base-ui/react/tabs";
import { InfoPopover } from "@/components/InfoPopover";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import {
  GAME_VARIANTS,
  toGameVariant,
  type GameVariant,
} from "@/lib/gameVariant";
import "./GameVariantPill.css";

export function GameVariantPill() {
  const { status, refreshStatus } = useGame();

  const activeGameVariant = toGameVariant(status?.variant);

  const onGameVariant = async (picked: GameVariant | null) => {
    if (!picked || picked === activeGameVariant) {
      return;
    }
    try {
      await rust.setVariant(picked);
    } catch (e) {
      toast(String(e), true);
    }
    refreshStatus();
  };

  if (!status?.exe_present) {
    return null;
  }

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
        {GAME_VARIANTS.map(({ id, label, title }) => (
          <Tabs.Tab
            key={id}
            value={id}
            className="game-variant-seg"
            title={title}
          >
            {label}
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
      </InfoPopover>
    </Tabs.Root>
  );
}
