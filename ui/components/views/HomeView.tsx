import { useEffect, useRef, useState } from "react";
import { InfoPopover } from "@/components/InfoPopover";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { useProgress } from "@/context/ProgressContext";
import * as rust from "@/lib/rust";
import { openLink } from "@/lib/links";
import { toast } from "@/lib/toast";
import gameVersionLabel from "@/assets/game-version.png";
import art1 from "@/assets/art/art-1.jpg";
import art2 from "@/assets/art/art-2.jpg";
import art3 from "@/assets/art/art-3.jpg";
import art5 from "@/assets/art/art-5.jpg";
import art6 from "@/assets/art/art-6.jpg";
import "./HomeView.css";

/** art-0 and art-4 are left out: neither frames well behind the hero copy. */
const HERO_ART = [art1, art2, art3, art5, art6];

const LINKS = {
  discord: "https://dsc.gg/elefrac",
  donate: "https://patreon.com/elementalfracture",
  patchnotes: "https://docs.elefrac.com/patchnotes",
  x: "https://x.com/elefracture",
  twitch: "https://twitch.tv/elementalfracture",
  youtube: "https://youtube.com/@elementalfracture",
};

export function greeting(name: string, pick: number) {
  const h = new Date().getHours();
  let lines: string[];
  if (h >= 22 || h < 5) {
    lines = [
      `Burning the midnight oil, ${name}?`,
      `The Hollow Lands never sleep, ${name}.`,
    ];
  } else if (h < 12) {
    lines = [`Good morning, ${name}!`, `Rise and cast, ${name}!`];
  } else if (h < 17) {
    lines = [
      `Good afternoon, ${name}!`,
      `Perfect weather for a Spellstorm, ${name}.`,
    ];
  } else {
    lines = [`Good evening, ${name}!`, `The storm rolls in at dusk, ${name}.`];
  }
  return lines[pick % lines.length];
}

export function formatEventTime(ev: { status?: string; start?: string }) {
  if (ev.status === "ACTIVE") {
    return "LIVE NOW";
  }
  if (!ev.start) {
    return "";
  }
  const d = new Date(ev.start);
  const diffMs = d.getTime() - Date.now();
  const when = d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (diffMs > 0 && diffMs < 36e5) {
    return `${when} (in ${Math.max(1, Math.round(diffMs / 6e4))} min)`;
  }
  if (diffMs > 0 && diffMs < 864e5) {
    return `${when} (in ${Math.round(diffMs / 36e5)} h)`;
  }
  return when;
}

function HeroArt() {
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
function useVariantTheme(variant: string | undefined) {
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

export function HomeView() {
  const { view } = useUI();
  const { settings } = useSettings();
  const {
    status,
    updating,
    installBusy,
    installNotice,
    refreshStatus,
    locateGame,
    downloadGame,
  } = useGame();
  const { news, events } = useLiveData();
  const progress = useProgress();

  const [greetPick] = useState(() => Math.floor(Math.random() * 2));
  const [launchBusy, setLaunchBusy] = useState(false);
  const { copy, fadeClass } = useVariantTheme(status?.variant);

  const name = settings?.username?.trim() || "breaker";
  const installed = Boolean(status?.exe_present);

  const defaultInstallMsg = !status?.game_path
    ? "No Spellbreak install configured. Locate an existing install or download the game."
    : "Spellbreak.exe was not found in the configured folder. Locate the right folder or re-download.";
  // The install notice takes over while a download runs or has just failed.
  const installMsg = installNotice ?? defaultInstallMsg;

  const onLaunch = async () => {
    setLaunchBusy(true);
    try {
      await rust.launchGame();
      toast("Launching Spellbreak…");
      // Opt-in (Settings → Launcher): quit once the game is on its way. Held
      // back a moment so the toast shows and the process is spawned first.
      if (settings?.close_on_launch) {
        setTimeout(() => {
          rust.quitLauncher().catch(() => {});
        }, 1200);
      }
    } catch (e) {
      toast(String(e), true);
    } finally {
      setLaunchBusy(false);
    }
  };

  /* No toast on success: the theme swap below is the confirmation. */
  const onVariant = async (variant: string) => {
    try {
      await rust.setVariant(variant);
    } catch (e) {
      toast(String(e), true);
    }
    refreshStatus();
  };

  return (
    <section className={"view" + (view === "home" ? " active" : "")}>
      <h2 className="greet">{greeting(name, greetPick)}</h2>

      <div className="hero">
        <HeroArt />
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-text">
          <span className={"eyebrow" + fadeClass}>{copy.eyebrow}</span>
          <h3 className={fadeClass.trim()}>{copy.title}</h3>
          <p className={fadeClass.trim()}>{copy.sub}</p>

          {installed ? (
            <div>
              <div className="variant-row">
                <img
                  src={gameVersionLabel}
                  alt="Game Version"
                  className="variant-label-img"
                />
                <InfoPopover label="What's the difference?">
                  <p>
                    <strong>Elemental Fracture</strong> is the community
                    edition: reworked talents, fresh balance and ongoing
                    updates.
                  </p>
                  <p>
                    <strong>Classic</strong> is Spellbreak as it was at
                    shutdown: the original balance, preserved untouched.
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
              <button
                className="launch-img"
                title={updating ? "Updating the game…" : "Launch Spellbreak"}
                disabled={launchBusy || updating}
                onClick={onLaunch}
              />
              <div className="launch-hint" />
            </div>
          ) : (
            <div>
              <p className="muted">{installMsg}</p>
              <div className="install-actions">
                <button
                  className="btn subtle"
                  disabled={installBusy}
                  onClick={locateGame}
                >
                  Locate existing install
                </button>
                <button
                  className="btn primary"
                  disabled={installBusy}
                  onClick={downloadGame}
                >
                  Download game…
                </button>
              </div>
            </div>
          )}

          {progress && (
            <div className="progress">
              <div className="progress-head">
                <span>{stageLabel(progress.stage)}</span>
                <span>{progress.message ?? ""}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, progress.percent)).toFixed(1)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {events && events.length > 0 && (
        <>
          <div className="row-head">
            <h3>Live events</h3>
          </div>
          <div className="cards">
            {events.slice(0, 4).map((ev, i) => (
              <div
                key={i}
                className="card event-card"
                onClick={() => ev.url && openLink(ev.url)}
              >
                <h4>{ev.name ?? ""}</h4>
                <span
                  className={
                    "event-time" + (ev.status === "ACTIVE" ? " live" : "")
                  }
                >
                  {formatEventTime(ev)}
                </span>
                <p>{ev.description ?? ""}</p>
                <span className="date">
                  {[
                    ev.location,
                    ev.interested ? `${ev.interested} interested` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="row-head">
        <h3>What’s new</h3>
      </div>
      <div className="cards">
        {news.slice(0, 6).map((item, i) => (
          <div
            key={i}
            className="card"
            onClick={() => item.url && openLink(item.url)}
          >
            <h4>{item.title ?? ""}</h4>
            <p>{item.body ?? ""}</p>
            <span className="date">{item.date ?? ""}</span>
          </div>
        ))}
      </div>

      <div className="social-row">
        <button
          className="img-btn h42 social-discord"
          onClick={() => openLink(LINKS.discord)}
          aria-label="Discord"
        />
        <button
          className="img-btn h42 social-donate"
          onClick={() => openLink(LINKS.donate)}
          aria-label="Donate"
        />
        <button
          className="img-btn h34 social-patchnotes"
          onClick={() => openLink(LINKS.patchnotes)}
          aria-label="Patch notes"
        />
        <button
          className="img-btn h34 social-x"
          onClick={() => openLink(LINKS.x)}
          aria-label="X"
        />
        <button
          className="img-btn h34 social-twitch"
          onClick={() => openLink(LINKS.twitch)}
          aria-label="Twitch"
        />
        <button
          className="img-btn h34 social-youtube"
          onClick={() => openLink(LINKS.youtube)}
          aria-label="YouTube"
        />
      </div>
    </section>
  );
}

export function stageLabel(stage: string) {
  const stages: Record<string, string> = {
    "download-base": "Downloading game",
    "extract-base": "Extracting game",
    "download-patch": "Downloading update",
    "extract-patch": "Installing update",
    "install-mods": "Installing mods",
    done: "Done",
  };
  return stages[stage] ?? stage;
}
