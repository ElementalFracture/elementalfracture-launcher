import { beforeEach, describe, expect, it, vi } from "vitest";

// The lib wrapper only translates our two-argument call into an options object
// for the Base UI toast manager, so the manager is stubbed and inspected.
const add = vi.hoisted(() => vi.fn(() => "toast-id"));
vi.mock("@/components/shadcn/toast", () => ({ toast: { add } }));

// The toastOnce latch is module state, so the module is re-imported per test.
async function freshToast() {
  vi.resetModules();
  return await import("../toast");
}

beforeEach(() => add.mockClear());

describe("toast", () => {
  it("adds an ordinary toast that dismisses after 5s", async () => {
    const { toast } = await freshToast();

    toast("Settings saved");

    expect(add).toHaveBeenCalledWith({
      title: "Settings saved",
      type: "info",
      priority: "low",
      timeout: 5000,
    });
  });

  it("adds an error toast announced urgently and held until dismissed", async () => {
    const { toast } = await freshToast();

    toast("Update failed", true);

    expect(add).toHaveBeenCalledWith({
      title: "Update failed",
      type: "error",
      priority: "high",
      // timeout 0: base-ui keeps it up until the player closes it.
      timeout: 0,
    });
  });

  it("returns the id the manager assigns", async () => {
    const { toast } = await freshToast();

    expect(toast("Mods installed")).toBe("toast-id");
  });
});

describe("toastOnce", () => {
  it("fires the first time only, for the lifetime of the app", async () => {
    const { toastOnce } = await freshToast();

    toastOnce("Update available: v6.0.3");
    toastOnce("Update available: v6.0.3");

    expect(add).toHaveBeenCalledTimes(1);
  });

  it("does not latch ordinary toasts", async () => {
    const { toast, toastOnce } = await freshToast();

    toastOnce("once");
    toast("regular");
    toast("regular");

    expect(add).toHaveBeenCalledTimes(3);
  });
});
