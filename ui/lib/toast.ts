import { toast as toastManager } from "@/components/shadcn/toast";

const TIMEOUT = 5000;
// Errors stay until the player dismisses them: base-ui treats timeout 0 as no
// auto-dismiss, so a failure worth reading can't slip away on its own.
const ERROR_TIMEOUT = 0;

export function toast(message: string, isError = false) {
  return toastManager.add({
    title: message,
    type: isError ? "error" : "info",
    priority: isError ? "high" : "low",
    timeout: isError ? ERROR_TIMEOUT : TIMEOUT,
  });
}

let toastOnceDone = false;
export function toastOnce(message: string) {
  if (toastOnceDone) {
    return;
  }
  toastOnceDone = true;
  toast(message);
}
