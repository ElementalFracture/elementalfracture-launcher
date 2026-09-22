import { describe, expect, it } from "vitest";
import { updateTarget, versionsBehind, versionsKnown } from "../versions";
import { makeVersions } from "@/test/fixtures";

describe("versionsBehind", () => {
  it("is false when both tracks match the CDN", () => {
    expect(versionsBehind(makeVersions())).toBe(false);
  });

  /* The two tracks ship separately: a balance release moves the game version
     on its own, and the appserver refuses the install until it is taken. */
  it("is true when only the game track is behind", () => {
    expect(
      versionsBehind(
        makeVersions({ local_game: "6.3.16", remote_game: "6.4.0" })
      )
    ).toBe(true);
  });

  it("is true when only the mod track is behind", () => {
    expect(
      versionsBehind(
        makeVersions({ local_mod: "3.17.0", remote_mod: "3.17.1" })
      )
    ).toBe(true);
  });

  /* A config.ini from before the split carries one combined version. */
  it("falls back to the combined version when the CDN names no track", () => {
    const pre = makeVersions({
      local: "6.0.2",
      remote: "6.0.3",
      local_game: null,
      remote_game: null,
      local_mod: null,
      remote_mod: null,
    });
    expect(versionsBehind(pre)).toBe(true);
    expect(versionsBehind({ ...pre, remote: "6.0.2" })).toBe(false);
  });

  /* An unreachable CDN says nothing, and nothing is not "out of date". */
  it("is false when there is no remote answer at all", () => {
    const offline = makeVersions({
      remote: null,
      remote_game: null,
      remote_mod: null,
    });
    expect(versionsBehind(offline)).toBe(false);
    expect(versionsKnown(offline)).toBe(false);
    expect(versionsKnown(makeVersions())).toBe(true);
  });
});

describe("updateTarget", () => {
  it("names the game version when that is the track behind", () => {
    expect(
      updateTarget(makeVersions({ local_game: "6.3.16", remote_game: "6.4.0" }))
    ).toBe("6.4.0");
  });

  it("names the mod version when the balance patch is already current", () => {
    expect(
      updateTarget(makeVersions({ local_mod: "3.17.0", remote_mod: "3.17.1" }))
    ).toBe("3.17.1");
  });
});
