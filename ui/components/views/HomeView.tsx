import { useEffect, useState } from "react";
import { useUI } from "@/context/UIContext";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import { useLiveData } from "@/context/LiveDataContext";
import { useProgress } from "@/context/ProgressContext";
import * as rust from "@/lib/rust";
import { openLink } from "@/lib/links";
import { toast } from "@/lib/toast";
import gameVersionLabel from "@/assets/game-version.png";
import art0 from "@/assets/art/art-0.jpg";
import art1 from "@/assets/art/art-1.jpg";
import art2 from "@/assets/art/art-2.jpg";
import art3 from "@/assets/art/art-3.jpg";
import art4 from "@/assets/art/art-4.jpg";
import art5 from "@/assets/art/art-5.jpg";
import art6 from "@/assets/art/art-6.jpg";
import "./HomeView.css";

const HERO_ART = [art0, art1, art2, art3, art4, art5, art6];

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
    lines = [`Burning the midnight oil, ${name}?`, `The Hollow Lands never sleep, ${name}.`];
  } else if (h < 12) {
    lines = [`Good morning, ${name}!`, `Rise and cast, ${name}!`];
  } else if (h < 17) {
    lines = [`Good afternoon, ${name}!`, `Perfect weather for a Spellstorm, ${name}.`];
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

export function HomeView() {
  const { view } = useUI();
  const { settings } = useSettings();
  const { status, updating, installBusy, installNotice, refreshStatus, locateGame, downloadGame } =
    useGame();
  const { news, events } = useLiveData();
  const progress = useProgress();

  const [greetPick] = useState(() => Math.floor(Math.random() * 2));
  const [launchBusy, setLaunchBusy] = useState(false);

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
    } catch (e) {
      toast(String(e), true);
    } finally {
      setLaunchBusy(false);
    }
  };

  const onVariant = async (variant: string) => {
    try {
      const v = await rust.setVariant(variant);
      toast(v === "ef" ? "Elemental Fracture balance active" : "Classic Spellbreak active");
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
          <span className="eyebrow">Elemental Fracture</span>
          <h3>The Hollow Lands still beckon, breaker</h3>
          <p>Community servers, restored battles, new balance. Spellbreak lives on.</p>

          {installed ? (
            <div>
              <div className="variant-row">
                <img src={gameVersionLabel} alt="Game Version" className="variant-label-img" />
                <div className="variant-pills">
                  <button
                    className={
                      "variant-pill variant-ef" + (status?.variant === "ef" ? " active" : "")
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
                <button className="btn subtle" disabled={installBusy} onClick={locateGame}>
                  Locate existing install
                </button>
                <button className="btn primary" disabled={installBusy} onClick={downloadGame}>
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
                  style={{ width: `${Math.max(0, Math.min(100, progress.percent)).toFixed(1)}%` }}
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
              <div key={i} className="card event-card" onClick={() => ev.url && openLink(ev.url)}>
                <h4>{ev.name ?? ""}</h4>
                <span className={"event-time" + (ev.status === "ACTIVE" ? " live" : "")}>
                  {formatEventTime(ev)}
                </span>
                <p>{ev.description ?? ""}</p>
                <span className="date">
                  {[ev.location, ev.interested ? `${ev.interested} interested` : ""]
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
          <div key={i} className="card" onClick={() => item.url && openLink(item.url)}>
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
        <button className="img-btn h34 social-x" onClick={() => openLink(LINKS.x)} aria-label="X" />
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
