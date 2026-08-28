import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountPill } from "../AccountPill";
import { SettingsProvider } from "@/context/SettingsContext";
import { FriendsProvider } from "@/context/FriendsContext";
import { makeSettings } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  getSettings: vi.fn(),
  detectWrappers: vi.fn(),
  friendsList: vi.fn(),
  friendAdd: vi.fn(),
  friendAccept: vi.fn(),
  friendRemove: vi.fn(),
  loginEmail: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn(), toastOnce: vi.fn() }));

const Providers = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <FriendsProvider>{children}</FriendsProvider>
  </SettingsProvider>
);

const renderPill = () => render(<AccountPill />, { wrapper: Providers });

const pill = () => screen.getByTitle("Account");

/* The pill renders once before settings arrive, and that first pass looks
   exactly like the guest case — so every assertion here has to wait for the
   load to land or it would pass without ever seeing the state under test.
   detectWrappers runs off the back of the same effect, once getSettings has
   resolved, which makes it the signal that the settled render is in. */
const settled = () =>
  waitFor(() => expect(commands.detectWrappers).toHaveBeenCalled());

beforeEach(() => {
  vi.clearAllMocks();
  commands.detectWrappers.mockResolvedValue([]);
  commands.friendsList.mockResolvedValue({
    status: "ok",
    data: {
      ok: true,
      me: { username: "Lytion" },
      friends: [],
      incoming: [],
      outgoing: [],
    },
  });
});

describe("AccountPill", () => {
  it("opens the friend drawer once an account is verified", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ auth_token: "tok", username: "Lytion" })
    );
    renderPill();
    await settled();
    await waitFor(() => expect(pill().textContent).toContain("Lytion"));

    fireEvent.click(pill());
    await waitFor(() =>
      expect(screen.getByLabelText("Close friend list")).toBeTruthy()
    );
  });

  /* A token can be on disk while its account never verified (name empty), so the
     token alone can't stand for an account: the drawer would only fill with
     invalid_token errors. */
  it("does not open the drawer for a token that never verified", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ auth_token: "rejected-tok", username: "" })
    );
    renderPill();
    await settled();
    await waitFor(() =>
      expect(pill().textContent).toContain("Not signed in")
    );

    fireEvent.click(pill());
    // The token modal is what a click means here, and the drawer stays shut.
    // (FriendsContext still polls on any stored token, so the friend list call
    // is not what this asserts on — only that no drawer came up.)
    await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
    expect(screen.queryByLabelText("Close friend list")).toBeNull();
  });

  it("distinguishes no token at all from one that failed", async () => {
    commands.getSettings.mockResolvedValue(
      makeSettings({ auth_token: "", username: "" })
    );
    renderPill();
    await settled();
    expect(pill().textContent).toContain("Sign in");
    expect(pill().textContent).not.toContain("Not signed in");
  });
});
