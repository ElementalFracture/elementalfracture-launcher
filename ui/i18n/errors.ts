/**
 * Backend failures, turned into something the user can read.
 *
 * The Rust side sends a code and the values that belong in the sentence (see
 * `src-tauri/src/error.rs`); the prose lives in the catalogues here, because
 * the frontend is the only side that knows what language is on screen.
 *
 * `errorText(e)` is what every `catch` should call — it takes whatever was
 * thrown, not just an AppError, so the old `String(e)` shape has a
 * one-for-one replacement at each call site. `toastError(e)` is the even
 * commoner shape: render it and put it in a toast.
 */
import type { AppError, ErrorCode } from "@/generated/bindings";
import { en } from "./locales/en";
import { _, type Key, type Params } from "./index";
import { toast } from "@/lib/toast";

/* Built from the English catalogue, so a code with no string of its own is
   caught and named rather than rendering as a raw key. */
const ERROR_KEYS: Record<string, true> = Object.fromEntries(
  Object.keys(en.errors).map((k) => [`errors.${k}`, true])
);

/** Thrown by `rust.unwrap()` so a rejected command carries its code, not just
    a rendered sentence. `message` keeps the code in it for logs and for the
    `String(e)` paths that haven't been converted. */
export class BackendError extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.code);
    this.name = "BackendError";
    this.appError = appError;
  }
}

export function isBackendError(e: unknown): e is BackendError {
  return e instanceof BackendError;
}

/** The catalogue key for a code, given the params that came with it.
 *
 *  Three codes don't map one-to-one, and each earns it: a suspension reads
 *  differently depending on whether it ends, and a missing wrapper reads
 *  differently inside a container, where "not installed" means on the host. */
function keyFor(code: ErrorCode, params: Params): Key {
  if (code === "accountSuspended" && params.permanent === "true") {
    return "errors.accountSuspendedPermanent";
  }
  if (code === "wrapperNotInstalled" && params.onHost === "true") {
    return "errors.wrapperNotInstalledOnHost";
  }
  return `errors.${code}` as Key;
}

/**
 * Render one failure.
 *
 * Anything that isn't a backend error — a thrown string, a TypeError from our
 * own code — falls through to its own text. Those aren't translatable and
 * shouldn't be swallowed.
 */
export function errorText(e: unknown): string {
  if (!isBackendError(e)) {
    return e instanceof Error ? e.message : String(e);
  }

  const { code, params } = e.appError;
  // params comes over the wire as Partial<Record<string, string>>; drop the
  // undefined holes so `format` sees a slot as either present or missing.
  const filled: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      filled[k] = v;
    }
  }

  const key = keyFor(code, filled);
  // A code this build has no string for: name it rather than showing nothing.
  const known = key in ERROR_KEYS;
  let text = known ? _(key, filled) : _("errors.unknown", { code });

  // The one composed message: a suspension may carry a reason to append.
  if (filled.reason) {
    text += `\n${_("errors.suspensionReason", filled)}`;
  }
  return text;
}

/** `toast(errorText(e), true)`, which is what almost every catch block wants. */
export function toastError(e: unknown) {
  toast(errorText(e), true);
}
