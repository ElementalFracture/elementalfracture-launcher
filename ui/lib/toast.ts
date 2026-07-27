import { useEffect, useState } from "react";

export interface ToastState {
  message: string;
  isError: boolean;
  key: number;
}

let state: ToastState | null = null;
let listeners: Array<(s: ToastState | null) => void> = [];
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;

function emit() {
  for (const l of listeners) {
    l(state);
  }
}

export function toast(message: string, isError = false) {
  seq += 1;
  state = { message, isError, key: seq };
  emit();
  clearTimeout(hideTimer);
  hideTimer = setTimeout(
    () => {
      state = null;
      emit();
    },
    isError ? 5000 : 2600
  );
}

export function useToastState() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.push(setS);
    return () => {
      listeners = listeners.filter((l) => l !== setS);
    };
  }, []);
  return s;
}

let toastOnceDone = false;
export function toastOnce(message: string) {
  if (toastOnceDone) {
    return;
  }
  toastOnceDone = true;
  toast(message);
}
