import { InfoPopover } from "@/components/InfoPopover";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import gameVersionLabel from "@/assets/game-version.png";
import "./VariantPicker.css";

/** Picks the balance the install runs: Elemental Fracture or Classic. */
export function VariantPicker() {
  const { status, refreshStatus } = useGame();

  /* No toast on success: the banner's theme swap is the confirmation. */
  const onVariant = async (variant: string) => {
    try {
      await rust.setVariant(variant);
    } catch (e) {
      toast(String(e), true);
    }
    refreshStatus();
  };

  return (
    <div className="variant-row">
      <img
        src={gameVersionLabel}
        alt="Game Version"
        className="variant-label-img"
      />
      <InfoPopover label="What's the difference?">
        <p>
          <strong>Elemental Fracture</strong> is the community edition: reworked
          talents, fresh balance and ongoing updates.
        </p>
        <p>
          <strong>Classic</strong> is Spellbreak as it was at shutdown: the
          original balance, preserved untouched.
        </p>
      </InfoPopover>
      <div className="variant-pills">
        <button
          className={
            "variant-pill variant-ef" +
            (status?.variant === "ef" ? " active" : "")
          }
          title="Elemental Fracture balance"
          onClick={() => onVariant("ef")}
        />
        <button
          className={
            "variant-pill variant-classic" +
            (status?.variant === "classic" ? " active" : "")
          }
          title="Classic Spellbreak"
          onClick={() => onVariant("classic")}
        />
      </div>
    </div>
  );
}
