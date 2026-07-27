import type { SVGProps } from "react";

/** Discord mark. Rendered inline rather than as an <img> so the sidebar's
 *  `fill` rules can recolour it on hover and when active. */
export function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M19.6 5.6A17 17 0 0 0 15.4 4l-.5 1a15.6 15.6 0 0 0-5.8 0l-.5-1a17 17 0 0 0-4.2 1.6C1.7 9.6 1 13.5 1.4 17.3A17.2 17.2 0 0 0 6.6 20l1.1-1.8c-.6-.2-1.2-.5-1.8-.9l.4-.3a12.2 12.2 0 0 0 10.4 0l.4.3c-.6.4-1.2.7-1.8.9L16.4 20a17.2 17.2 0 0 0 5.2-2.7c.5-4.4-.7-8.2-2-11.7zM8.5 14.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
    </svg>
  );
}
