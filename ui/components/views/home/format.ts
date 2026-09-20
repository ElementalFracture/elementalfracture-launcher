/** Display strings Home builds from live data: the greeting, event times,
    and the pipeline stage names the backend emits. */
import { _, getLocale, type Key } from "@/i18n";

/** The two lines each band of the day can open with. `greeting()` picks one;
    the catalogue holds the words. */
const GREETINGS: readonly (readonly [Key, Key])[] = [
  ["home.greeting.night", "home.greeting.nightAlt"],
  ["home.greeting.morning", "home.greeting.morningAlt"],
  ["home.greeting.afternoon", "home.greeting.afternoonAlt"],
  ["home.greeting.evening", "home.greeting.eveningAlt"],
];

export function greeting(name: string, pick: number) {
  const h = new Date().getHours();
  const band =
    h >= 22 || h < 5
      ? GREETINGS[0]
      : h < 12
        ? GREETINGS[1]
        : h < 17
          ? GREETINGS[2]
          : GREETINGS[3];
  return _(band[pick % band.length], { name });
}

export function formatEventTime(ev: { status?: string; start?: string }) {
  if (ev.status === "ACTIVE") {
    return _("home.events.live");
  }
  if (!ev.start) {
    return "";
  }
  const d = new Date(ev.start);
  const diffMs = d.getTime() - Date.now();
  /* The date itself is Intl's to write, in the language on screen rather than
     the OS's — the countdown beside it is already in that language. */
  const when = d.toLocaleString(getLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  if (diffMs > 0 && diffMs < 36e5) {
    return _("home.events.inMinutes", {
      when,
      minutes: Math.max(1, Math.round(diffMs / 6e4)),
    });
  }
  if (diffMs > 0 && diffMs < 864e5) {
    return _("home.events.inHours", { when, hours: Math.round(diffMs / 36e5) });
  }
  return when;
}

/** The backend names its stages on the wire in kebab-case; the catalogue keys
    them in camelCase like everything else, so the two are mapped here. */
const STAGE_KEYS: Record<string, Key> = {
  "download-base": "home.stages.downloadBase",
  "extract-base": "home.stages.extractBase",
  "verify-base": "home.stages.verifyBase",
  "download-patch": "home.stages.downloadPatch",
  "extract-patch": "home.stages.extractPatch",
  "install-mods": "home.stages.installMods",
  "download-playtest": "home.stages.downloadPlaytest",
  "extract-playtest": "home.stages.extractPlaytest",
  done: "home.stages.done",
};

export function stageLabel(stage: string) {
  const key = STAGE_KEYS[stage];
  // A stage this build has no name for shows its wire name rather than
  // nothing: an unlabelled bar reads as a hang.
  return key ? _(key) : stage;
}
