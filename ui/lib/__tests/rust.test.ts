import { describe, expect, it } from "vitest";
import { unwrap } from "../rust";

describe("unwrap", () => {
  it("returns the payload of an ok result", () => {
    expect(unwrap({ status: "ok", data: "/games/spellbreak" })).toBe("/games/spellbreak");
  });

  it("passes falsy payloads through instead of treating them as failure", () => {
    expect(unwrap({ status: "ok", data: null })).toBeNull();
    expect(unwrap({ status: "ok", data: "" })).toBe("");
  });

  it("throws the backend's message so callers can toast it verbatim", () => {
    expect(() => unwrap({ status: "error", error: "Spellbreak.exe not found" })).toThrowError(
      "Spellbreak.exe not found"
    );
  });
});
