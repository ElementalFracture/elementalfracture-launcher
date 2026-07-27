import type { SVGProps } from "react";

/** Group-of-people glyph for the "online" topbar pill. */
export function PlayersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M16 11a3.5 3.5 0 1 0-3.4-4.4A5 5 0 0 1 14.5 11c.5.1 1 .1 1.5 0zM9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8.7 1.3c1.9.4 3.3 1.5 3.3 3.2V19h-4v-2.5c0-1.3-.5-2.4-1.4-3.2.7 0 1.4-.1 2.1 0zM9 13c3 0 6 1.3 6 3.5V19H3v-2.5C3 14.3 6 13 9 13z" />
    </svg>
  );
}
