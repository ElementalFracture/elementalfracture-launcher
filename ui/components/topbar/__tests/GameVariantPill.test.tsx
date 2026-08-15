import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GameVariantPill } from "../GameVariantPill";

const game = vi.hoisted(() => ({
  gameVariant: "ef" as string,
  exePresent: true,
  refreshStatus: vi.fn(),
}));
const rust = vi.hoisted(() => ({ setVariant: vi.fn(async () => "ef") }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/context/GameContext", () => ({
  useGame: () => ({
    status: { variant: game.gameVariant, exe_present: game.exePresent },
    refreshStatus: game.refreshStatus,
  }),
}));
vi.mock("@/lib/rust", () => rust);
vi.mock("@/lib/toast", () => ({ toast }));

const seg = (label: string) => screen.getByRole("tab", { name: label });

/** The side the toggle shows as picked, read off the segments themselves. */
const active = () =>
  screen
    .getAllByRole("tab")
    .find((b) => b.getAttribute("aria-selected") === "true")?.textContent;

beforeEach(() => {
  vi.clearAllMocks();
  game.gameVariant = "ef";
  game.exePresent = true;
});

describe("GameVariantPill", () => {
  it("shows the balance the install runs as the picked side", () => {
    game.gameVariant = "classic";
    render(<GameVariantPill />);
    expect(active()).toBe("Classic");
  });

  /* The fill is placed from the picked side's own box, which the indicator
     measures. jsdom lays nothing out, so all it can say here is that the fill
     is in the track and holding itself back until there are real numbers —
     the same guard that keeps it from flashing at the left edge on load. */
  it("keeps the fill hidden until the picked side has been measured", () => {
    const { container } = render(<GameVariantPill />);
    const fill = container.querySelector<HTMLElement>(".fill-selected");
    expect(fill).not.toBeNull();
    expect(fill!.hidden).toBe(true);
  });

  it("falls back to Elemental Fracture when the balance is unknown", () => {
    game.gameVariant = "unknown";
    render(<GameVariantPill />);
    expect(active()).toBe("Elemental Fracture");
  });

  it("swaps the install to the side that was clicked", async () => {
    render(<GameVariantPill />);
    fireEvent.click(seg("Classic"));
    expect(rust.setVariant).toHaveBeenCalledWith("classic");
    // The pill holds no game variant of its own: the swap is only picked up by
    // re-reading the install.
    await waitFor(() => expect(game.refreshStatus).toHaveBeenCalled());
  });

  /* Setting a game variant renames paks in the install, so the side already in
     place is not worth doing over. */
  it("leaves the install alone when the picked side is clicked", () => {
    render(<GameVariantPill />);
    fireEvent.click(seg("Elemental Fracture"));
    expect(rust.setVariant).not.toHaveBeenCalled();
    expect(game.refreshStatus).not.toHaveBeenCalled();
  });

  it("puts a failed swap in front of the player", async () => {
    rust.setVariant.mockRejectedValueOnce("Set the game folder first");
    render(<GameVariantPill />);
    fireEvent.click(seg("Classic"));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Set the game folder first", true)
    );
  });

  /* The swap works on an install that is there. Without one the control could
     only ever come back an error, so the strip does without it. */
  it("stays out of the strip until the game is installed", () => {
    game.exePresent = false;
    const { container } = render(<GameVariantPill />);
    expect(container.firstChild).toBeNull();
  });

  it("explains the two balances behind the note", () => {
    render(<GameVariantPill />);
    fireEvent.click(screen.getByTitle("What's the difference?"));
    const note = document.querySelector(".info-pop") as HTMLElement;
    expect(note.textContent).toContain("community edition");
    expect(note.textContent).toContain("as it was at shutdown");
  });
});
