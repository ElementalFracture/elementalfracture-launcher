import type { SVGProps } from "react";

/** Crossed blades for the "in game" topbar pill. */
export function InGameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M6.9 3 3 6.9l6.3 6.3-2.1 2.1-1.4-1.4-1.4 1.4 1.7 1.8-2.8 2.8 1.4 1.4 2.8-2.8 1.8 1.7 1.4-1.4-1.4-1.4 2.1-2.1zM17.1 3 21 6.9l-6.3 6.3 2.1 2.1 1.4-1.4 1.4 1.4-1.7 1.8 2.8 2.8-1.4 1.4-2.8-2.8-1.8 1.7-1.4-1.4 1.4-1.4-2.1-2.1z" />
    </svg>
  );
}
