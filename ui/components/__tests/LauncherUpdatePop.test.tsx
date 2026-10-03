import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LauncherUpdatePop } from "../LauncherUpdatePop";

const game = vi.hoisted(() => ({
  launcherInfo: null as null | {
    current: string;
    remote: string | null;
    update: boolean;
    checked: boolean;
    game_running: boolean;
  },
  installBusy: false,
  updating: false,
}));
// Never resolves on success: the backend restarts the launcher.
const rust = vi.hoisted(() => ({
  updateLauncher: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/context/GameContext", () => ({
  useGame: () => ({ ...game, launcherUpdatePop: false }),
}));
vi.mock("@/lib/rust", () => rust);
vi.mock("@/i18n/errors", () => ({ toastError: vi.fn() }));

const info = (over: Partial<NonNullable<typeof game.launcherInfo>> = {}) => ({
  current: "3.5.5",
  remote: "3.5.6",
  update: true,
  checked: true,
  game_running: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  game.launcherInfo = null;
  game.installBusy = false;
  game.updating = false;
});

describe("LauncherUpdatePop", () => {
  it("applies an available update without a click", async () => {
    game.launcherInfo = info();
    render(<LauncherUpdatePop />);
    await waitFor(() => expect(rust.updateLauncher).toHaveBeenCalledTimes(1));
  });

  it("waits for a running game, and says so", () => {
    game.launcherInfo = info({ game_running: true });
    render(<LauncherUpdatePop />);
    expect(rust.updateLauncher).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveProperty("disabled", true);
  });

  it("waits for a download in progress", () => {
    game.launcherInfo = info();
    game.installBusy = true;
    render(<LauncherUpdatePop />);
    expect(rust.updateLauncher).not.toHaveBeenCalled();
  });

  it("stays hidden and idle when current", () => {
    game.launcherInfo = info({ update: false });
    const { container } = render(<LauncherUpdatePop />);
    expect(container.firstChild).toBeNull();
    expect(rust.updateLauncher).not.toHaveBeenCalled();
  });
});
