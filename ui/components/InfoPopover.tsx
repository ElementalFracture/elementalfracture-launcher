import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import "./InfoPopover.css";

export function InfoPopover({
  label = "More info",
  align = "start",
  children,
}: {
  label?: string;
  /** Which of the trigger's edges the note lines up with. Anything near the
   *  right of the window wants "end", or a start-aligned note opens rightward
   *  and runs off it. */
  align?: "start" | "center" | "end";
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="info-btn" aria-label={label} title={label}>
          i
        </button>
      </PopoverTrigger>
      <PopoverContent className="info-pop" align={align} sideOffset={8}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
