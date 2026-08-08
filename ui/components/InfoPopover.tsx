import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/shadcn/popover";
import "./InfoPopover.css";

export function InfoPopover({
  label = "More info",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="info-btn" aria-label={label} title={label}>
          i
        </button>
      </PopoverTrigger>
      <PopoverContent className="info-pop" align="start" sideOffset={8}>
        {children}
      </PopoverContent>
    </Popover>
  );
}
