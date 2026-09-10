import { describe, expect, it } from "vitest";
import { atLeast } from "../timing";

/* Timers never fire early, so a lower bound on elapsed time is a fact rather
   than a race. The upper bounds are loose on purpose — they only need to catch
   a floor that stacks on top of the work instead of overlapping it. */
describe("atLeast", () => {
  it("holds a fast answer back to the floor", async () => {
    const started = Date.now();
    await atLeast(Promise.resolve("done"), 200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(190);
  });

  it("passes the resolved value straight through", async () => {
    await expect(atLeast(Promise.resolve(42), 10)).resolves.toBe(42);
  });

  it("adds nothing to work that already outran the floor", async () => {
    const started = Date.now();
    await atLeast(new Promise((resolve) => setTimeout(resolve, 120)), 10);
    const took = Date.now() - started;
    expect(took).toBeGreaterThanOrEqual(110);
    expect(took).toBeLessThan(400);
  });

  it("rejects at once instead of waiting the floor out", async () => {
    const started = Date.now();
    await expect(
      atLeast(Promise.reject(new Error("nope")), 1000)
    ).rejects.toThrow("nope");
    expect(Date.now() - started).toBeLessThan(400);
  });
});
