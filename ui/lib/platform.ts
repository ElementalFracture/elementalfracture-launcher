/** Host platform checks. Not a backend call — the webview knows this itself. */
export const isWindows = typeof navigator !== "undefined" && navigator.platform.startsWith("Win");
