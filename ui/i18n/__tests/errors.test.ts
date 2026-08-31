import { beforeEach, describe, expect, it } from "vitest";
import type { AppError } from "@/generated/bindings";
import { BackendError, errorText, isBackendError } from "../errors";
import { setLocale } from "../index";

/* errorText renders in whatever the store holds, so every case starts from a
   known one rather than inheriting the last test's. */
beforeEach(() => setLocale("en"));

const boom = (code: AppError["code"], params: Record<string, string> = {}) =>
  new BackendError({ code, params });

describe("errorText", () => {
  it("renders the code in the language on screen", () => {
    expect(errorText(boom("noGameFolder"))).toBe(
      "Set the game folder first (Settings)."
    );
    setLocale("fr");
    expect(errorText(boom("noGameFolder"))).toBe(
      "Définissez d'abord le dossier du jeu (Paramètres)."
    );
  });

  it("fills in the params the backend sent with it", () => {
    expect(errorText(boom("paksNotFound", { path: "/games/spellbreak" }))).toBe(
      "Paks folder not found: /games/spellbreak"
    );
  });

  /* The frame is translated, the library's own words are not — that is the
     honest best we can do for an io::Error. */
  it("keeps an untranslatable detail intact inside a translated frame", () => {
    setLocale("fr");
    expect(errorText(boom("io", { detail: "No such file or directory" }))).toBe(
      "Erreur de fichier : No such file or directory"
    );
  });

  it("appends a suspension reason when there is one", () => {
    expect(
      errorText(
        boom("accountSuspendedUntil", { ends: "3 May", reason: "cheating" })
      )
    ).toBe(
      "This account has been suspended. The suspension will end on 3 May.\nReason: cheating"
    );
  });

  it("leaves the reason line off when the backend sent none", () => {
    expect(errorText(boom("accountSuspendedUntil", { ends: "3 May" }))).toBe(
      "This account has been suspended. The suspension will end on 3 May."
    );
  });

  /* Two codes read differently depending on a flag that rides with them. */
  it("says permanent for a suspension with no end date", () => {
    expect(errorText(boom("accountSuspended", { permanent: "true" }))).toBe(
      "This account has been permanently suspended."
    );
    expect(errorText(boom("accountSuspended", { permanent: "false" }))).toBe(
      "This account has been suspended."
    );
  });

  it("says 'on the host' for a wrapper missing outside the container", () => {
    expect(
      errorText(boom("wrapperNotInstalled", { wrapper: "wine", onHost: "true" }))
    ).toContain("isn't installed on the host");
    expect(
      errorText(
        boom("wrapperNotInstalled", { wrapper: "wine", onHost: "false" })
      )
    ).toContain("'wine' isn't installed.");
  });

  /* A launcher talking to a newer backend. Naming the code beats an empty
     toast, and beats rendering the raw key. */
  it("names a code it has no string for", () => {
    const e = new BackendError({
      code: "somethingAddedLater" as AppError["code"],
      params: {},
    });
    expect(errorText(e)).toBe("Something went wrong (somethingAddedLater).");
  });

  /* Not every throw comes from Rust — a TypeError in our own code must not be
     swallowed into a generic message. */
  it("passes a non-backend error through as its own text", () => {
    expect(errorText(new TypeError("x is not a function"))).toBe(
      "x is not a function"
    );
    expect(errorText("a bare string")).toBe("a bare string");
  });
});

describe("isBackendError", () => {
  it("tells a coded failure from anything else", () => {
    expect(isBackendError(boom("noGameFolder"))).toBe(true);
    expect(isBackendError(new Error("nope"))).toBe(false);
    expect(isBackendError(undefined)).toBe(false);
  });
});
