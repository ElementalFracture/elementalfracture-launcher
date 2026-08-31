import { describe, expect, it } from "vitest";
import { unwrap } from "../rust";
import { isBackendError } from "@/i18n/errors";

describe("unwrap", () => {
  it("returns the payload of an ok result", () => {
    expect(unwrap({ status: "ok", data: "/games/spellbreak" })).toBe(
      "/games/spellbreak"
    );
  });

  it("passes falsy payloads through instead of treating them as failure", () => {
    expect(unwrap({ status: "ok", data: null })).toBeNull();
    expect(unwrap({ status: "ok", data: "" })).toBe("");
  });

  /* The failure carries a code, not a sentence: the prose is chosen in the
     UI, in whatever language is on screen. Callers render it with
     errorText() rather than reading .message. */
  it("throws the backend's code and params, not a rendered message", () => {
    const boom = () =>
      unwrap({
        status: "error",
        error: { code: "paksNotFound", params: { path: "/games/spellbreak" } },
      });

    expect(boom).toThrow();
    try {
      boom();
    } catch (e) {
      expect(isBackendError(e)).toBe(true);
      if (isBackendError(e)) {
        expect(e.appError.code).toBe("paksNotFound");
        expect(e.appError.params.path).toBe("/games/spellbreak");
      }
    }
  });
});
