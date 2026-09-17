import { useEffect } from "react";
import * as rust from "@/lib/rust";
import { toastError } from "@/i18n/errors";

/** When quickstart (Play on Spellbreak in Steam) couldn't start the game and
    opened the launcher instead, say why, once. Renders nothing. */
export function QuickstartNotice() {
  useEffect(() => {
    rust.takeQuickstartNotice().catch(toastError);
  }, []);
  return null;
}
