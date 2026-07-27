import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Every spec needs the module's own state (the visible toast, the toastOnce
// latch) fresh, so the module is re-imported per test rather than at the top.
async function freshToast() {
  vi.resetModules();
  return await import("../toast");
}

describe("toast store", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("publishes a message to a subscribed hook", async () => {
    const { toast, useToastState } = await freshToast();
    const { result } = renderHook(() => useToastState());

    expect(result.current).toBeNull();
    act(() => toast("Settings saved"));
    expect(result.current).toMatchObject({ message: "Settings saved", isError: false });
  });

  it("hides an ordinary toast after 2.6s and an error after 5s", async () => {
    const { toast, useToastState } = await freshToast();
    const { result } = renderHook(() => useToastState());

    act(() => toast("Launching Spellbreak…"));
    act(() => void vi.advanceTimersByTime(2599));
    expect(result.current).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBeNull();

    act(() => toast("Update failed", true));
    act(() => void vi.advanceTimersByTime(2600));
    expect(result.current).toMatchObject({ isError: true });
    act(() => void vi.advanceTimersByTime(2400));
    expect(result.current).toBeNull();
  });

  it("restarts the timer on a replacement rather than inheriting the old one", async () => {
    const { toast, useToastState } = await freshToast();
    const { result } = renderHook(() => useToastState());

    act(() => toast("first"));
    act(() => void vi.advanceTimersByTime(2000));
    act(() => toast("second"));
    // The first toast's deadline would land here; the second must survive it.
    act(() => void vi.advanceTimersByTime(600));
    expect(result.current).toMatchObject({ message: "second" });
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current).toBeNull();
  });

  it("gives each toast a new key so an identical message re-animates", async () => {
    const { toast, useToastState } = await freshToast();
    const { result } = renderHook(() => useToastState());

    act(() => toast("Mods installed"));
    const first = result.current!.key;
    act(() => toast("Mods installed"));
    expect(result.current!.key).not.toBe(first);
  });

  it("stops notifying a hook once it unmounts", async () => {
    const { toast, useToastState } = await freshToast();
    const { result, unmount } = renderHook(() => useToastState());

    act(() => toast("visible"));
    unmount();
    // Nothing to assert on the unmounted hook beyond it not throwing; the
    // point is that the listener list shed it.
    expect(() => act(() => toast("after unmount"))).not.toThrow();
    expect(result.current).toMatchObject({ message: "visible" });
  });
});

describe("toastOnce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires the first time only, for the lifetime of the app", async () => {
    const { toastOnce, useToastState } = await freshToast();
    const { result } = renderHook(() => useToastState());

    act(() => toastOnce("Update available: v6.0.3"));
    expect(result.current).toMatchObject({ message: "Update available: v6.0.3" });

    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current).toBeNull();

    act(() => toastOnce("Update available: v6.0.3"));
    expect(result.current).toBeNull();
  });

  it("does not latch ordinary toasts", async () => {
    const { toast, toastOnce, useToastState } = await freshToast();
    const { result } = renderHook(() => useToastState());

    act(() => toastOnce("once"));
    act(() => void vi.advanceTimersByTime(3000));
    act(() => toast("regular"));
    expect(result.current).toMatchObject({ message: "regular" });
  });
});
