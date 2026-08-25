/** Display strings Home builds from live data: the greeting, event times,
    and the pipeline stage names the backend emits. */

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

export function stageLabel(stage: string) {
  const stages: Record<string, string> = {
    "download-base": "Downloading game",
    "extract-base": "Extracting game",
    "download-patch": "Downloading update",
    "extract-patch": "Installing update",
    "install-mods": "Installing mods",
    "download-playtest": "Downloading playtest build",
    "extract-playtest": "Installing playtest build",
    done: "Done",
  };
  return stages[stage] ?? stage;
}
