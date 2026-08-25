import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Toaster, toast } from "../toast";

/** The text column, which is what carries the selection affordances. */
const textOf = (message: string) =>
  screen.getByText(message).closest("div[class*='flex-col']")!;

const show = (options: Parameters<typeof toast.add>[0]) => {
  render(<Toaster />);
  act(() => {
    toast.add(options);
  });
};

describe("error toasts", () => {
  it("lets their text be selected, so a backend message can be copied", () => {
    show({ title: "Update failed: connection reset", type: "error" });
    expect(textOf("Update failed: connection reset").className).toContain(
      "select-text"
    );
  });

  it("opts that text out of swipe-to-dismiss, or the drag would throw it away", () => {
    // Base UI's Toast.Root ignores a pointerdown that starts inside an element
    // carrying this attribute, which is what makes a drag select rather than
    // dismiss. The name comes from @base-ui/react internals/constants.
    show({ title: "Update failed", type: "error" });
    expect(
      textOf("Update failed").hasAttribute("data-base-ui-swipe-ignore")
    ).toBe(true);
  });
});

describe("ordinary toasts", () => {
  it("keep the swipe, and stay unselectable with it", () => {
    show({ title: "Settings saved", type: "info" });
    const text = textOf("Settings saved");
    expect(text.className).not.toContain("select-text");
    expect(text.hasAttribute("data-base-ui-swipe-ignore")).toBe(false);
  });
});
