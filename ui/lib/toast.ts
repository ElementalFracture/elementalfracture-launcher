import { toast as toastManager } from "@/components/ui/toast";

const TIMEOUT = 2600;
const ERROR_TIMEOUT = 5000;

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
