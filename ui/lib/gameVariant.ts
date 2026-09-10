import type { Key } from "@/i18n";

export type GameVariant = "ef" | "classic" | "playtest";

export interface GameVariantInfo {
  id: GameVariant;
  // What the balance is called in a button, a tab or a section head.
  label: string;
  // The longer form, for a tooltip with room to say which balance it means.
  title: Key;
  /** Only shown to accounts holding the badge — the playtest channel. */
  testersOnly?: boolean;
}

const EF = {
  id: "ef",
  label: "Elemental Fracture",
  title: "topbar.variant.efTitle",
} satisfies GameVariantInfo;

const CLASSIC = {
  id: "classic",
  label: "Classic",
  title: "topbar.variant.classicTitle",
} satisfies GameVariantInfo;

const PLAYTEST = {
  id: "playtest",
  label: "Playtest",
  title: "topbar.variant.playtestTitle",
  testersOnly: true,
} satisfies GameVariantInfo;

export const GAME_VARIANTS: readonly GameVariantInfo[] = [
  EF,
  CLASSIC,
  PLAYTEST,
];

export function toGameVariant(
  reported: string | null | undefined
): GameVariant {
  if (reported === "classic") {
    return "classic";
  }
  return reported === "playtest" ? "playtest" : "ef";
}

/** Who may see the playtest channel at all. Devs get it alongside testers. */
export function canSeePlaytest(
  account: { is_tester?: boolean; is_dev?: boolean } | null | undefined
): boolean {
  return Boolean(account?.is_tester || account?.is_dev);
}
