import { Fragment, useEffect, type ReactNode } from "react";
import { useSettings } from "@/context/SettingsContext";
import { resolveLocale, setLocale, useLocale } from "./index";

/**
 * Two jobs: copy the saved language into the store, and repaint the app when
 * it changes.
 *
 * The second one needs the `key`. Components call `_` like any function, so
 * React has no idea they read the language and would leave them showing the
 * old words. Changing a `key` makes React drop everything below and build it
 * again — every `_` call runs a second time, now in the new language.
 *
 *     <Fragment key="en">  →  <Fragment key="fr">   rebuilds the whole app
 *
 * That is a real repaint, so two things follow:
 *
 *  - State inside components below is lost — an open dropdown, a half-typed
 *    field. Settings fields save on blur and the picker saves on click, so
 *    nothing typed is actually dropped.
 *  - The gate sits *inside* the providers, so contexts and requests already in
 *    flight survive. Switching language doesn't refetch the player count or
 *    send you back to Home.
 */
export function LocaleGate({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const wanted = resolveLocale(settings?.language ?? "");

  /* In an effect, not straight in the render: setting the store is what asks
     React to render again, and doing that mid-render is both a side effect and
     too late to matter. The store already starts on the OS language, so this
     only really fires for someone who picked something else. */
  useEffect(() => {
    setLocale(wanted);
  }, [wanted]);

  return <Fragment key={useLocale()}>{children}</Fragment>;
}
