import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { LiveDataProvider, useLiveData } from "../LiveDataContext";

const commands = vi.hoisted(() => ({
  getPlayers: vi.fn(),
  getEvents: vi.fn(),
  getNews: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));

function Probe() {
  useLiveData();
  return null;
}

const renderProvider = () =>
  render(
    (
      <LiveDataProvider>
        <Probe />
      </LiveDataProvider>
    ) as ReactNode
  );

beforeEach(() => {
  vi.clearAllMocks();
  commands.getPlayers.mockResolvedValue({ status: "ok", data: {} });
  commands.getEvents.mockResolvedValue({ status: "ok", data: { events: [] } });
  commands.getNews.mockResolvedValue({ status: "ok", data: [] });
});

afterEach(() => vi.useRealTimers());

describe("the startup fetch", () => {
  it("asks for all three once", async () => {
    renderProvider();
    await waitFor(() => expect(commands.getNews).toHaveBeenCalledTimes(1));
    expect(commands.getPlayers).toHaveBeenCalledTimes(1);
    expect(commands.getEvents).toHaveBeenCalledTimes(1);
  });
});

/* Vitest runs with import.meta.env.DEV set, which is the same switch a `tauri
   dev` build takes — so this is the dev-build schedule under test. A release
   build reads the feed once and never polls it. */
describe("the news poll, on the schedule a dev build takes", () => {
  it("re-reads the feed every 60s, so a dashboard edit lands without a restart", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderProvider();
    await waitFor(() => expect(commands.getNews).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(commands.getNews).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(commands.getNews).toHaveBeenCalledTimes(3);
  });

  /* Events poll in a release build too, just at five minutes; a dev build
     drops that to a minute so a dashboard edit is worth waiting for. */
  it("looks for events on the same minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderProvider();
    await waitFor(() => expect(commands.getEvents).toHaveBeenCalledTimes(1));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(commands.getEvents).toHaveBeenCalledTimes(2);
  });

  it("stops polling once the provider goes away", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { unmount } = renderProvider();
    await waitFor(() => expect(commands.getNews).toHaveBeenCalledTimes(1));

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(180_000);
    });
    expect(commands.getNews).toHaveBeenCalledTimes(1);
    expect(commands.getEvents).toHaveBeenCalledTimes(1);
    expect(commands.getPlayers).toHaveBeenCalledTimes(1);
  });
});
