import type React from "react";

/** Nothing in Settings has a Save behind it — a field is saved when you leave
    it, so Enter finishes an edit by taking the focus away. */
export function blurOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.currentTarget.blur();
  }
}
