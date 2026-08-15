export type GameVariant = "ef" | "classic";

export interface GameVariantInfo {
  id: GameVariant;
  // What the balance is called in a button, a tab or a section head.
  label: string;
  // The longer form, for a tooltip with room to say which balance it means.
  title: string;
}

export const GAME_VARIANTS: readonly GameVariantInfo[] = [
  {
    id: "ef",
    label: "Elemental Fracture",
    title: "Elemental Fracture Balance",
  },
  { id: "classic", label: "Classic", title: "Classic Spellbreak" },
];

export function toGameVariant(
  reported: string | null | undefined
): GameVariant {
  return reported === "classic" ? "classic" : "ef";
}
