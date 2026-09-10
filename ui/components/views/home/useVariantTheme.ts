import { useEffect, useRef, useState } from "react";
import { toGameVariant, type GameVariant } from "@/lib/gameVariant";
import { _ } from "@/i18n";

/** Hero copy per balance: EF sells the community edition, Classic the
    preserved one, and the playtest one sets expectations for a playtest.

    Read through `_` at the moment it is needed rather than held in a module
    constant, so a language switch mid-session gets the new words — the copy
    outlives a render here, riding in state across the fade. */
function heroText(variant: GameVariant) {
  return {
    title: _(`home.hero.${variant}Title`),
    sub: _(`home.hero.${variant}Sub`),
  };
}

/* Both of these are the JS half of a duration the stylesheet also carries:
   they say how long to hold `body.theming` and when to swap the words, while
   App.css ("EF ⇄ Classic switch") says how long the transitions themselves
   run. Change one and change the other, or the class comes off mid-fade. */

/** How long the theme recolour runs. */
const THEME_MS = 1600;
/** Midpoint of the copy fade: text is swapped while it's invisible. */
const COPY_SWAP_MS = 900;

/** The body class carrying the palette. EF is the default, so it has none. */
function setThemeClass(variant: GameVariant) {
  document.body.classList.toggle("classic", variant === "classic");
  document.body.classList.toggle("playtest", variant === "playtest");
}

/**
 * Drive the look off the installed variant: `body.classic` carries the warm
 * palette and `body.playtest` the blueprint blue of the playtest build (EF is
 * the
 * default, no class), while `body.theming` slows every recolour for the length
 * of a switch (so ordinary hover feedback stays snappy). Only the hero copy
 * actually animates — it fades out, swaps at the midpoint, and fades back in.
 */
// TODO: I think this could be done in css.
export function useVariantTheme(variant: string | undefined) {
  const [copy, setCopy] = useState(() => heroText("ef"));
  const [fading, setFading] = useState(false);
  // Which theme is on screen. Null until the first status arrives, which is
  // what tells a fresh load (apply instantly) from a real toggle (animate).
  const applied = useRef<GameVariant | null>(null);

  useEffect(() => {
    if (!variant) {
      return;
    }
    const theme = toGameVariant(variant);
    if (applied.current === theme) {
      return;
    }
    const first = applied.current === null;
    applied.current = theme;

    if (first) {
      setThemeClass(theme);
      setCopy(heroText(theme));
      return;
    }

    document.body.classList.add("theming");
    void document.body.offsetWidth; // commit the slow transitions before recolouring
    setThemeClass(theme);
    setFading(true);

    const recolour = setTimeout(
      () => document.body.classList.remove("theming"),
      THEME_MS
    );
    const swap = setTimeout(() => {
      setCopy(heroText(theme));
      setFading(false);
    }, COPY_SWAP_MS);
    return () => {
      clearTimeout(recolour);
      clearTimeout(swap);
    };
  }, [variant]);

  return { copy, fadeClass: fading ? " fading" : "" };
}
