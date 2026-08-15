import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Footer } from "../Footer";

const ui = vi.hoisted(() => ({ view: "home" as string }));
const links = vi.hoisted(() => ({ openLink: vi.fn() }));

vi.mock("@/context/UIContext", () => ({ useUI: () => ({ view: ui.view }) }));
vi.mock("@/lib/links", () => links);

beforeEach(() => {
  vi.clearAllMocks();
  ui.view = "home";
});

describe("Footer", () => {
  it("carries the social strip on home", () => {
    render(<Footer />);
    expect(screen.getByRole("button", { name: "Patch notes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "YouTube" })).toBeTruthy();
  });

  /* The three that say a word still name the service they lead to, and say it
     around the word rather than instead of it — so what is read out and what
     is on the button are the same thing. */
  it("names the service behind a labelled button", () => {
    render(<Footer />);
    const connect = screen.getByRole("button", { name: "Connect on Discord" });
    expect(connect.textContent).toBe("Connect");
  });

  it("sends a click out to the community's own page", () => {
    render(<Footer />);
    fireEvent.click(screen.getByRole("button", { name: "Connect on Discord" }));
    expect(links.openLink).toHaveBeenCalledWith("https://dsc.gg/elefrac");
  });

  /* Mods and Settings are working screens; the way out belongs on the landing
     tab, and the views below it get the height back. */
  it.each(["mods", "settings"])("stays off the %s view", (view) => {
    ui.view = view;
    const { container } = render(<Footer />);
    expect(container.firstChild).toBeNull();
  });
});
