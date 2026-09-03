/**
 * The translation layer.
 *
 * Import `_` and call it with a key. You get back the text in whatever
 * language is on screen right now:
 *
 *     import { _ } from "@/i18n";
 *
 *     _("settings.urls.title")
 *     → "URLs"
 *
 *     _("settings.launcher.version", { version: "1.4" })
 *     → "(v1.4)"
 *
 * A key is just the path to a string in `en.ts`:
 *
 *     en.ts   settings: { urls: { title: "URLs" } }
 *     key     "settings.urls.title"
 *
 * Keys are typed, so a typo fails `tsc` instead of rendering nothing. Every
 * other catalogue has to hold every key `en.ts` holds, or the build fails as
 * well.
 *
 * `_` is a plain function, not a hook — that is what keeps call sites this
 * short. The catch: React never learns that a component called it, so nothing
 * re-renders when the language changes. `LocaleGate` is what solves that, by
 * rebuilding the tree below it.
 *
 * All of this is a few dozen lines instead of a library because the launcher
 * needs exactly two things: put values into a sentence, and choose between a
 * singular and a plural. If the copy ever needs more, `@messageformat/core`
 * replaces the body of `format()` and no call site has to change.
 */
import { useSyncExternalStore } from "react";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { it } from "./locales/it";
import { ja } from "./locales/ja";
import { ko } from "./locales/ko";
import { ptBR } from "./locales/pt-BR";
import { zhHans } from "./locales/zh-Hans";
import { zhHant } from "./locales/zh-Hant";

/** `en` is `as const`, so TypeScript sees each value as that exact string
    rather than as `string`. That is what lets `Key` below be a list of the
    real paths.

    Other languages have the same keys but different words, so `Catalogue` is
    the same shape with the leaves widened back to `string`. Each of the other
    catalogues declares itself as `Catalogue`, which is what turns a missing
    key into a build error. */
type Source = typeof en;
type Translated<T> = {
  [K in keyof T]: T[K] extends string ? string : Translated<T[K]>;
};
export type Catalogue = Translated<Source>;

/** The locales that have a catalogue. Order is the order the picker shows.

    A tag is only as specific as it needs to be: `fr` covers every French
    region, while Portuguese and Chinese carry the part that actually changes
    the words — the Brazilian variety, and the two scripts. `resolveLocale`
    below is what maps an OS tag like `pt-PT` or `zh-TW` onto one of these. */
export const LOCALES = [
  "en",
  "es",
  "pt-BR",
  "fr",
  "de",
  "it",
  "zh-Hans",
  "zh-Hant",
  "ko",
  "ja",
] as const;
export type Locale = (typeof LOCALES)[number];

/* Every catalogue ships inside the bundle. They are a few KB each, and
   fetching them on demand would show untranslated text for a moment at every
   cold start. */
const CATALOGUES: Record<Locale, Catalogue> = {
  en,
  es,
  "pt-BR": ptBR,
  fr,
  de,
  it,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  ko,
  ja,
};

/** What the picker saves, and what `Settings.language` holds. `""` means
    "follow the OS" — stored as that rather than as the language it resolves
    to today, so someone who moves machines keeps following the OS. */
export type LanguageSetting = "" | Locale;

/** Every language named in its own language — "Français", not "French" — so
    someone who has landed in a language they can't read can still get out. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  ko: "한국어",
  ja: "日本語",
};

/* ---------------- key typing ---------------- */

/** Every dotted path through the catalogue that ends on a string:

        { settings: { urls: { title: "URLs" } } }  →  "settings.urls.title"

    `Key` is the union of all of them, which is what makes `_` reject a key
    that doesn't exist. */
type Paths<T> = T extends string
  ? ""
  : {
      [K in keyof T & string]: Paths<T[K]> extends ""
        ? K
        : `${K}.${Paths<T[K]>}`;
    }[keyof T & string];

export type Key = Paths<Source>;

/** The values that go into a string's `{slots}`. */
export type Params = Record<string, string | number>;

/* ---------------- locale resolution ---------------- */

function isLocale(tag: string): tag is Locale {
  return (LOCALES as readonly string[]).includes(tag);
}

/** The subtags that mean Traditional Chinese. The script is what the
    catalogues are split on, but an OS reports a region — "zh-TW", not
    "zh-Hant" — so both spellings are listed. Everything else Chinese is
    Simplified. */
const TRADITIONAL_CHINESE = ["hant", "tw", "hk", "mo"];

/**
 * Match one OS language tag against the catalogues we have.
 *
 *     "fr-CA"  → "fr"        the region doesn't change the words
 *     "pt-PT"  → "pt-BR"     the only Portuguese we speak
 *     "zh-TW"  → "zh-Hant"   the script the region implies
 *     "zh"     → "zh-Hans"
 *     "sv-SE"  → undefined   a language we don't speak
 */
function matchTag(tag: string): Locale | undefined {
  const [primary, ...rest] = tag.toLowerCase().split("-");
  if (primary === "zh") {
    return rest.some((part) => TRADITIONAL_CHINESE.includes(part))
      ? "zh-Hant"
      : "zh-Hans";
  }
  return LOCALES.find((l) => l.toLowerCase().split("-")[0] === primary);
}

/**
 * Turn a saved setting into a language that actually has a catalogue.
 *
 *     "fr"  → "fr"           a language we speak
 *     ""    → OS language    the webview says "fr-CA", the region is ignored
 *     "sv"  → "en"           anything we don't speak
 */
export function resolveLocale(
  setting: string,
  navigatorLanguages?: readonly string[]
): Locale {
  if (isLocale(setting)) {
    return setting;
  }
  const tags =
    navigatorLanguages ??
    (typeof navigator === "undefined" ? [] : navigator.languages) ??
    [];
  for (const tag of tags) {
    const hit = matchTag(tag);
    if (hit) {
      return hit;
    }
  }
  return "en";
}

/* ---------------- the store ---------------- */

/* Starts on the OS language rather than a flat "en", so the common case — no
   language ever picked — is already right on the first paint, and never has to
   be corrected once the settings load. */
let locale: Locale = resolveLocale("");
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return locale;
}

/** Switch the language and tell everyone watching. `LocaleGate` calls this
    when the saved setting changes; nothing else needs it outside tests. */
export function setLocale(next: Locale) {
  if (next === locale) {
    return;
  }
  locale = next;
  for (const notify of listeners) {
    notify();
  }
}

/** Watch for language changes from outside React. Returns the unsubscribe. */
export function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** The same, for React. Only `LocaleGate` needs it: everything else calls `_`
    and is re-rendered by the gate. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

/* ---------------- lookup and formatting ---------------- */

/** Follow a dotted path into a catalogue:

        lookup(en, "settings.urls.title")  →  "URLs"
        lookup(en, "settings.nope")        →  undefined

    A miss returns `undefined` instead of throwing. `tsc` says that can't
    happen, but it can at runtime — a stale build, a hand-edited catalogue —
    and a missing string should fall back, not take the view down. */
function lookup(catalogue: Catalogue, key: string): string | undefined {
  const hit = key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown>)?.[part],
      catalogue
    );
  return typeof hit === "string" ? hit : undefined;
}

/** Put values into a string's slots:

        format("Paks folder not found: {path}", { path: "/games" })
        → "Paks folder not found: /games"

    A slot with no value is left standing — "Paks folder not found: {path}".
    On purpose: that reads as a bug, where quietly dropping it would read as a
    finished sentence and never get noticed. */
export function format(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  );
}

/** Choose between `key` and `key_other`, using `params.count`:

        friends.online        "{count} friend online"   "{count} ami en ligne"
        friends.online_other  "{count} friends online"  "{count} amis en ligne"

    `Intl.PluralRules` makes the choice, not `count === 1`, because languages
    disagree about which form a number takes. English puts 0 with the plural,
    French with the singular:

        count   English             French
        0       0 friends online    0 ami en ligne
        1       1 friend online     1 ami en ligne
        5       5 friends online    5 amis en ligne

    `one` and `other` are that API's own category names, not English words —
    which is why the suffix is `_other` and not `_plural`, and why a language
    with more forms can add `_few` or `_many` to the same scheme.

    Only a key handed a numeric `count` is ever suffixed. Everything else goes
    through untouched. */
function pluralKey(key: string, params?: Params): string {
  if (!params || typeof params.count !== "number") {
    return key;
  }
  return new Intl.PluralRules(locale).select(params.count) === "one"
    ? key
    : `${key}_other`;
}

/**
 * Translate one key, putting `params` into its `{slots}`.
 *
 *     _("settings.urls.title")
 *     → "URLs"
 *
 *     _("errors.paksNotFound", { path: "/games" })
 *     → "Paks folder not found: /games"
 *
 * The language is read from the store on every call, so `_` works anywhere —
 * in a component, in an event handler, in a module with no React around it —
 * and always renders in the language that is on screen.
 */
export function _(key: Key, params?: Params): string {
  const wanted = pluralKey(key, params);
  // Four tries, in order: this language, English, English without the plural
  // suffix, then the key itself. Something always renders — never a blank.
  const template =
    lookup(CATALOGUES[locale], wanted) ??
    lookup(en, wanted) ??
    lookup(en, key) ??
    key;
  return format(template, params);
}
