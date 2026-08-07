import { useEffect, useRef, useState } from "react";

/** Hero copy per balance: EF sells the community edition, Classic the preserved one. */
const HERO_TEXT = {
  ef: {
    eyebrow: "Elemental Fracture",
    title: "The Hollow Lands still beckon, breaker",
    sub: "Community servers, restored battles, new balance. Spellbreak lives on.",
  },
  classic: {
    eyebrow: "Spellbreak Classic",
    title: "The Hollow Lands, as they were before.",
    sub: "Community servers, restored battles, the original balance. Spellbreak, preserved.",
  },
} as const;

/** How long the theme recolour runs — matched to the hero-art crossfade. */
const THEME_MS = 2600;
/** Midpoint of the copy fade: text is swapped while it's invisible. */
const COPY_SWAP_MS = 1500;

/**
 * Drive the EF ⇄ Classic look off the installed variant: `body.classic` carries
 * the warm palette, and `body.theming` slows every recolour for the length of a
 * switch (so ordinary hover feedback stays snappy). Only the hero copy actually
 * animates — it fades out, swaps at the midpoint, and fades back in.
 */
// TODO: I think this could be done in css.
export function useVariantTheme(variant: string | undefined) {
  const [copy, setCopy] = useState<(typeof HERO_TEXT)[keyof typeof HERO_TEXT]>(
    HERO_TEXT.ef
  );
  const [fading, setFading] = useState(false);
  // Which theme is on screen. Null until the first status arrives, which is
  // what tells a fresh load (apply instantly) from a real toggle (animate).
  const applied = useRef<"ef" | "classic" | null>(null);

  useEffect(() => {
    if (!variant) {
      return;
    }
    const theme = variant === "classic" ? "classic" : "ef";
    if (applied.current === theme) {
      return;
    }
    const first = applied.current === null;
    applied.current = theme;

    if (first) {
      document.body.classList.toggle("classic", theme === "classic");
      setCopy(HERO_TEXT[theme]);
      return;
    }

    document.body.classList.add("theming");
    void document.body.offsetWidth; // commit the slow transitions before recolouring
    document.body.classList.toggle("classic", theme === "classic");
    setFading(true);

    const recolour = setTimeout(
      () => document.body.classList.remove("theming"),
      THEME_MS
    );
    const swap = setTimeout(() => {
      setCopy(HERO_TEXT[theme]);
      setFading(false);
    }, COPY_SWAP_MS);
    return () => {
      clearTimeout(recolour);
      clearTimeout(swap);
    };
  }, [variant]);

  return { copy, fadeClass: fading ? " fading" : "" };
}
