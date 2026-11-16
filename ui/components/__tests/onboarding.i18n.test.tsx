import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Wizard } from "../Wizard";
import { AccountModal } from "../modals/AccountModal";
import { LocaleGate } from "@/i18n/LocaleGate";
import { fr } from "@/i18n/locales/fr";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { UIProvider } from "@/context/UIContext";
import { makeSettings, makeStatus, makeVersions } from "@/test/fixtures";

const commands = vi.hoisted(() => ({
  checkGameFolder: vi.fn().mockResolvedValue({
    verdict: "ok",
    store: null,
    path: null,
    detail: null,
    fixed: false,
    restarting: false,
  }),
  suggestedInstallDir: vi.fn().mockResolvedValue(null),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  detectWrappers: vi.fn(),
  getStatus: vi.fn(),
  getVersions: vi.fn(),
  getLauncherUpdate: vi.fn(),
  loginEmail: vi.fn(),
  autoFindGame: vi.fn(),
  pickGameDir: vi.fn(),
}));

vi.mock("@/generated/bindings", () => ({ commands }));
const toasts = vi.hoisted(() => ({ toast: vi.fn(), toastOnce: vi.fn() }));
vi.mock("@/lib/toast", () => toasts);

const Providers = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <GameProvider>
      <UIProvider>{children}</UIProvider>
    </GameProvider>
  </SettingsProvider>
);

const renderFr = (ui: ReactNode) =>
  render(<LocaleGate>{ui}</LocaleGate>, { wrapper: Providers });

beforeEach(() => {
  vi.clearAllMocks();
  // onboarded: false is what opens the wizard.
  commands.getSettings.mockResolvedValue(
    makeSettings({ language: "fr", onboarded: false })
  );
  commands.detectWrappers.mockResolvedValue([]);
  commands.getStatus.mockResolvedValue(makeStatus());
  commands.getVersions.mockResolvedValue(makeVersions());
  commands.getLauncherUpdate.mockResolvedValue({
    current: "3.0.2",
    remote: null,
    update: false,
  });
});

describe("the wizard", () => {
  it("opens on the welcome step in the saved language", async () => {
    renderFr(<Wizard />);
    expect(await screen.findByText(fr.wizard.welcomeTitle)).toBeTruthy();
    expect(screen.getByText(fr.wizard.welcomeSub)).toBeTruthy();
  });

  it("translates every step it walks through", async () => {
    renderFr(<Wizard />);
    fireEvent.click(await screen.findByText(fr.wizard.next));

    expect(await screen.findByText(fr.wizard.gameTitle)).toBeTruthy();
    expect(screen.getByText(fr.wizard.gameYes)).toBeTruthy();
    fireEvent.click(screen.getByText(fr.wizard.gameNo));

    // The sign-in step is the account dialog's own form, shared not copied —
    // these are the same assertions "the sign-in dialog" makes below, which is
    // the whole point of SignInForm.
    expect(await screen.findByText(fr.account.title)).toBeTruthy();
    expect(screen.getByPlaceholderText(fr.account.password)).toBeTruthy();
    expect(screen.getByText(fr.account.forgot)).toBeTruthy();
    expect(screen.getByText(fr.account.createOne)).toBeTruthy();
    expect(screen.getByText(fr.account.quickStart)).toBeTruthy();
    // Skip is the one thing onboarding adds on top of it.
    fireEvent.click(screen.getByText(fr.wizard.skip));

    expect(await screen.findByText(fr.wizard.doneTitle)).toBeTruthy();
    expect(screen.getByText(fr.wizard.enter)).toBeTruthy();
  });

  /* The title used to be a finished sentence held in state, so it kept the
     language it was built in. It now holds the name and is built at render. */
  it("names the account on the last step", async () => {
    commands.loginEmail.mockResolvedValue({
      status: "ok",
      data: { username: "Lytion" },
    });
    renderFr(<Wizard />);
    fireEvent.click(await screen.findByText(fr.wizard.next));
    fireEvent.click(await screen.findByText(fr.wizard.gameNo));

    fireEvent.change(await screen.findByPlaceholderText(fr.account.email), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByPlaceholderText(fr.account.password), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByText(fr.account.signIn));

    expect(
      await screen.findByText(
        fr.wizard.doneTitleNamed.replace("{name}", "Lytion")
      )
    ).toBeTruthy();
  });

  it("refuses an empty sign-in in the same language", async () => {
    renderFr(<Wizard />);
    fireEvent.click(await screen.findByText(fr.wizard.next));
    fireEvent.click(await screen.findByText(fr.wizard.gameNo));
    fireEvent.click(await screen.findByText(fr.account.signIn));

    expect(
      await screen.findByText(fr.errors.enterEmailAndPassword)
    ).toBeTruthy();
  });
});

describe("the sign-in dialog", () => {
  it("translates the form and every link on it", async () => {
    renderFr(<AccountModal open onOpenChange={() => {}} />);
    expect(await screen.findByText(fr.account.title)).toBeTruthy();
    expect(screen.getByText(fr.account.forgot)).toBeTruthy();
    expect(screen.getByText(fr.account.createOne)).toBeTruthy();
    expect(screen.getByText(fr.account.signIn)).toBeTruthy();
    expect(screen.getByText(fr.account.quickStart)).toBeTruthy();
  });

  /* The guide used to be onboarding's alone. It sits on both now, so this is
     what would catch it being wired into only one of them again. */
  it("offers the guide, with the question that introduces it", async () => {
    renderFr(<AccountModal open onOpenChange={() => {}} />);
    expect(await screen.findByText(fr.account.needHelp)).toBeTruthy();
    expect(screen.getByText(fr.account.quickStart)).toBeTruthy();
  });

  /* The badge used to be an English " (dev)" glued onto the sentence; the
     whole greeting is one catalogue string now, role included. */
  it("greets a badged account with the role inside the sentence", async () => {
    commands.loginEmail.mockResolvedValue({
      status: "ok",
      data: { username: "Doobs", is_dev: true },
    });
    renderFr(<AccountModal open onOpenChange={() => {}} />);

    fireEvent.change(await screen.findByPlaceholderText(fr.account.email), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByPlaceholderText(fr.account.password), {
      target: { value: "pw" },
    });
    fireEvent.click(screen.getByText(fr.account.signIn));

    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith(
        fr.account.welcomeBackAs
          .replace("{name}", "Doobs")
          .replace("{role}", fr.account.roleDev)
      )
    );
  });
});
