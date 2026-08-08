import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { FriendsProvider, statusRank, statusText, useFriends } from "../FriendsContext";
import { SettingsProvider } from "../SettingsContext";
import { makeSettings } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  detectWrappers: vi.fn(),
  friendsList: vi.fn(),
  friendAdd: vi.fn(),
  friendAccept: vi.fn(),
  friendRemove: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/toast", () => ({
  toast,
  toastOnce: vi.fn(),
}));

const ok = (data: unknown) => ({ status: "ok", data });

const graph = {
  ok: true,
  me: { username: "Lytion", status: "online" },
  friends: [{ username: "Doobs", status: "in_game" }],
  incoming: [],
  outgoing: [],
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <FriendsProvider>{children}</FriendsProvider>
  </SettingsProvider>
);

const renderFriends = () => renderHook(() => useFriends(), { wrapper });

beforeEach(() => {
  toast.mockClear();
  commands.getSettings.mockResolvedValue(makeSettings({ auth_token: "tok-abc" }));
  commands.detectWrappers.mockResolvedValue([]);
  commands.friendsList.mockResolvedValue(ok(graph));
  commands.friendAdd.mockResolvedValue(ok({ ok: true, state: "sent", username: "Breadman" }));
  commands.friendAccept.mockResolvedValue(ok({ ok: true }));
  commands.friendRemove.mockResolvedValue(ok({ ok: true }));
});

describe("presence helpers", () => {
  it("spells in_game as two words", () => {
    expect(statusText("in_game")).toBe("in game");
    expect(statusText("online")).toBe("online");
    expect(statusText(undefined)).toBe("offline");
  });

  it("ranks in-game friends above online ones, and both above offline", () => {
    expect([undefined, "online", "in_game"].map((s) => statusRank(s as never))).toEqual([2, 1, 0]);
  });
});

describe("loading the graph", () => {
  it("fetches it once a token is set", async () => {
    const { result } = renderFriends();
    await waitFor(() => expect(result.current.friends).not.toBeNull());
    expect(result.current.friends?.me?.username).toBe("Lytion");
  });

  it("asks for nothing at all while the account is a guest", async () => {
    commands.getSettings.mockResolvedValue(makeSettings({ auth_token: "" }));
    const { result } = renderFriends();
    await act(async () => {
      await result.current.refreshFriends();
    });
    expect(commands.friendsList).not.toHaveBeenCalled();
    expect(result.current.friends).toBeNull();
  });

  it("keeps the last-known list when the sidecar goes away", async () => {
    const { result } = renderFriends();
    await waitFor(() => expect(result.current.friends).not.toBeNull());

    commands.friendsList.mockRejectedValue(new Error("offline"));
    await act(async () => {
      await result.current.refreshFriends();
    });
    expect(result.current.friends?.friends).toHaveLength(1);
  });

  it("ignores a payload the server did not mark ok", async () => {
    commands.friendsList.mockResolvedValue(ok({ ok: false, error: "invalid_token" }));
    const { result } = renderFriends();
    await act(async () => {
      await result.current.refreshFriends();
    });
    expect(result.current.friends).toBeNull();
  });
});

describe("friend actions", () => {
  it("re-reads the graph after a successful action", async () => {
    const { result } = renderFriends();
    await waitFor(() => expect(result.current.friends).not.toBeNull());
    commands.friendsList.mockClear();

    await act(async () => {
      await result.current.runFriendAction("accept", "Breadman");
    });
    expect(commands.friendAccept).toHaveBeenCalledWith("Breadman");
    expect(commands.friendsList).toHaveBeenCalled();
  });

  it("says a request was sent, and says so differently when it was reciprocal", async () => {
    const { result } = renderFriends();
    await waitFor(() => expect(result.current.friends).not.toBeNull());

    await act(async () => {
      await result.current.runFriendAction("add", "Breadman");
    });
    expect(toast).toHaveBeenLastCalledWith("Friend request sent to Breadman.");

    commands.friendAdd.mockResolvedValue(ok({ ok: true, state: "accepted", username: "Breadman" }));
    await act(async () => {
      await result.current.runFriendAction("add", "Breadman");
    });
    expect(toast).toHaveBeenLastCalledWith("You're now friends with Breadman.");
  });

  it("turns a server error code into wording a player can act on", async () => {
    commands.friendAdd.mockResolvedValue(ok({ ok: false, error: "user_not_found" }));
    const { result } = renderFriends();
    await waitFor(() => expect(result.current.friends).not.toBeNull());

    await act(async () => {
      await result.current.runFriendAction("add", "Nobody");
    });
    expect(toast).toHaveBeenLastCalledWith("No player with that username.", true);
  });

  it("falls back to a generic message for an error code it does not know", async () => {
    commands.friendAdd.mockResolvedValue(ok({ ok: false, error: "teapot" }));
    const { result } = renderFriends();
    await waitFor(() => expect(result.current.friends).not.toBeNull());

    await act(async () => {
      await result.current.runFriendAction("add", "Breadman");
    });
    expect(toast).toHaveBeenLastCalledWith("Friend server unavailable, try again.", true);
  });

  it("leaves the graph alone when the action fails", async () => {
    commands.friendRemove.mockResolvedValue(ok({ ok: false, error: "user_not_found" }));
    const { result } = renderFriends();
    await waitFor(() => expect(result.current.friends).not.toBeNull());
    commands.friendsList.mockClear();

    await act(async () => {
      await result.current.runFriendAction("remove", "Doobs");
    });
    expect(commands.friendsList).not.toHaveBeenCalled();
  });
});
