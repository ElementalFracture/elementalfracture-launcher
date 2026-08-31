import * as rust from "@/lib/rust";
import { toastError } from "@/i18n/errors";

/**
 * Open a URL in the user's browser, reporting failure rather than throwing.
 *
 * The deliberate exception to the `rust.*` convention: this is called from a
 * dozen click handlers, and making each one catch a rejection it can do
 * nothing about is worse than the lost visibility. Everything else that
 * reaches the backend goes through `rust.*` directly.
 */
export function openLink(url: string) {
  rust.openUrl(url).catch(toastError);
}
