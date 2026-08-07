import { useEffect, useState } from "react";
import art1 from "@/assets/art/art-1.jpg";
import art2 from "@/assets/art/art-2.jpg";
import art3 from "@/assets/art/art-3.jpg";
import art5 from "@/assets/art/art-5.jpg";
import art6 from "@/assets/art/art-6.jpg";
import "./HeroArt.css";

/** art-0 and art-4 are left out: neither frames well behind the hero copy. */
const HERO_ART = [art1, art2, art3, art5, art6];

/** The rotating promo art behind the hero: two layers that crossfade. */
export function HeroArt() {
  const [front, setFront] = useState(0);
  const [layers, setLayers] = useState<[number, number]>(() => {
    const start = Math.floor(Math.random() * HERO_ART.length);
    return [start, start];
  });

  // Preload so a crossfade never reveals a half-loaded layer.
  useEffect(() => {
    for (const src of HERO_ART) {
      new Image().src = src;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setLayers(([a, b]) => {
        const current = front === 0 ? a : b;
        const next = (current + 1) % HERO_ART.length;
        return front === 0 ? [a, next] : [next, b];
      });
      setFront((f) => 1 - f);
    }, 18_000);
    return () => clearInterval(id);
  }, [front]);

  return (
    <>
      <div
        className={"hero-bg" + (front === 0 ? " visible" : "")}
        style={{ backgroundImage: `url(${HERO_ART[layers[0]]})` }}
        aria-hidden="true"
      />
      <div
        className={"hero-bg" + (front === 1 ? " visible" : "")}
        style={{ backgroundImage: `url(${HERO_ART[layers[1]]})` }}
        aria-hidden="true"
      />
    </>
  );
}
