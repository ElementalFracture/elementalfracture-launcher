import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "../TopBar";

const links = vi.hoisted(() => ({ openLink: vi.fn() }));
vi.mock("@/lib/links", () => links);

/* Only the logo is under test; the pills carry their own suites and their own
   contexts, which this render has none of. */
vi.mock("../GameVariantPill", () => ({ GameVariantPill: () => null }));
vi.mock("../InGamePill", () => ({ InGamePill: () => null }));
vi.mock("../AccountPill", () => ({ AccountPill: () => null }));

describe("the logo", () => {
  const logo = () => screen.getByRole("button", { name: /Elemental Fracture/ });

  it("opens the site in the browser", () => {
    render(<TopBar />);
    logo().click();
    expect(links.openLink).toHaveBeenCalledWith("https://elefrac.com");
  });

  /* An <a href> would take the webview itself to the site and strand the user
     there with no way back — the whole reason this is a button. */
  it("is a button, not a link that navigates the webview", () => {
    render(<TopBar />);
    expect(document.querySelector("#topbar a")).toBeNull();
  });
});
