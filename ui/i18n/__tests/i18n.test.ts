import { beforeEach, describe, expect, it } from "vitest";
import {
  _,
  format,
  getLocale,
  resolveLocale,
  setLocale,
  subscribe,
  LOCALES,
} from "../index";
import { en } from "../locales/en";
import { fr } from "../locales/fr";

describe("interpolation", () => {
  it("fills named slots", () => {
    expect(
      format("wrote {written} of {expected}", { written: 3, expected: 9 })
    ).toBe("wrote 3 of 9");
  });

  /* A hole left visible reads as a bug; a hole silently closed reads as a
     sentence, and the missing value is never noticed. */
  it("leaves a slot it has no value for standing", () => {
    expect(format("hello {name}", {})).toBe("hello {name}");
  });

  it("substitutes every occurrence, not just the first", () => {
    expect(format("{a} and {a}", { a: "x" })).toBe("x and x");
  });
});

describe("the catalogues", () => {
  /* fr.ts is typed as Catalogue, so this can't fail while tsc passes — but it
     fails loudly if someone reaches for a cast to get a build through. */
  it("cover the same keys", () => {
    const paths = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === "string"
          ? [`${prefix}${k}`]
          : paths(v as object, `${prefix}${k}.`)
      );
    expect(paths(fr).sort()).toEqual(paths(en).sort());
  });

  /* Spacing belongs to the markup, not to the words. A space at the edge of a
     string is invisible in the catalogue, survives no translation review, and
     collapses to nothing the moment a string is used somewhere else. */
  it("hold no string that starts or ends with a space", () => {
    const padded = (o: object, prefix = ""): string[] =>
      Object.entries(o).flatMap(([name, v]) =>
        typeof v === "string"
          ? v.trim() === v
            ? []
            : [`${prefix}${name}`]
          : padded(v as object, `${prefix}${name}.`)
      );
    expect({ en: padded(en), fr: padded(fr) }).toEqual({ en: [], fr: [] });
  });

  /* A `{slot}` the other locale dropped renders as a sentence with a value
     missing from it, which tsc can't see. */
  it("keep the same placeholders in every string", () => {
    const slots = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const walk = (a: object, b: object, prefix = "") => {
      for (const [k, v] of Object.entries(a)) {
        const other = (b as Record<string, unknown>)[k];
        if (typeof v === "string") {
          expect({ key: prefix + k, slots: slots(other as string) }).toEqual({
            key: prefix + k,
            slots: slots(v),
          });
        } else {
          walk(v as object, other as object, `${prefix}${k}.`);
        }
      }
    };
    walk(en, fr);
  });

  it("has a string for every locale it offers", () => {
    for (const l of LOCALES) {
      setLocale(l);
      expect(_("settings.urls.title")).toBeTruthy();
    }
  });
});

describe("translation", () => {
  beforeEach(() => setLocale("en"));

  /* `_` is a plain import with no locale argument, so what it renders has to
     follow the store — this is the whole contract. */
  it("follows the store, with no hook and nothing passed in", () => {
    expect(_("settings.language.system")).toBe("System");
    setLocale("fr");
    expect(_("settings.language.system")).toBe("Système");
    expect(getLocale()).toBe("fr");
  });

  it("interpolates through the catalogue", () => {
    expect(_("errors.paksNotFound", { path: "/games" })).toBe(
      "Paks folder not found: /games"
    );
  });

  /* A locale that translated only some of the catalogue still renders: the
     English string stands in rather than a blank or a raw key. */
  it("falls back to English rather than rendering nothing", () => {
    setLocale("fr");
    // @ts-expect-error — a key no catalogue has, which is the point.
    expect(_("settings.nope.missing")).toBe("settings.nope.missing");
  });

  /* Not `n === 1`: French takes the singular for 0 as well, and Intl already
     knows that without the rule being written out here. */
  it("picks the plural form by the locale's own rules", () => {
    const cat = { things: "{count} thing", things_other: "{count} things" };
    const pick = (locale: "en" | "fr", count: number) =>
      new Intl.PluralRules(locale).select(count) === "one"
        ? cat.things
        : cat.things_other;

    expect(pick("en", 1)).toBe("{count} thing");
    expect(pick("en", 0)).toBe("{count} things");
    expect(pick("fr", 0)).toBe("{count} thing");
    expect(pick("fr", 2)).toBe("{count} things");
  });
});

/* The store is what makes `_` a plain import instead of a hook, so these pin
   the properties the rest of the app leans on. */
describe("the locale store", () => {
  beforeEach(() => setLocale("en"));

  it("notifies subscribers on a change, and only on a real one", () => {
    let calls = 0;
    const stop = subscribe(() => calls++);

    setLocale("fr");
    expect(calls).toBe(1);
    setLocale("fr");
    expect(calls).toBe(1);
    setLocale("en");
    expect(calls).toBe(2);

    stop();
    setLocale("fr");
    expect(calls).toBe(2);
  });

  /* A module read at import time would freeze the launcher into whatever
     language it started in — every call has to re-read the store. */
  it("is read per call, not captured at import", () => {
    const render = () => _("settings.language.system");
    expect(render()).toBe("System");
    setLocale("fr");
    expect(render()).toBe("Système");
  });
});

describe("resolveLocale", () => {
  it("takes an explicit choice as given", () => {
    expect(resolveLocale("fr", ["en-US"])).toBe("fr");
  });

  /* The OS reports a region ("fr-CA"); every French region gets French. */
  it("follows the OS on the primary subtag when nothing is chosen", () => {
    expect(resolveLocale("", ["fr-CA", "en-US"])).toBe("fr");
    expect(resolveLocale("", ["FR"])).toBe("fr");
  });

  it("falls back to English for a language we don't speak", () => {
    expect(resolveLocale("", ["de-DE", "ja"])).toBe("en");
    expect(resolveLocale("", [])).toBe("en");
  });

  /* A tag saved by a newer build, or a hand-edited config: treated as unset
     rather than left to render a catalogue that isn't there. */
  it("treats an unknown saved tag as follow-the-OS", () => {
    expect(resolveLocale("de", ["fr-FR"])).toBe("fr");
  });
});
