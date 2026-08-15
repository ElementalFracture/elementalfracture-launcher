import { FileText } from "lucide-react";
import { openLink } from "@/lib/links";
import "./SocialRow.css";

const LINKS = {
  discord: "https://dsc.gg/elefrac",
  donate: "https://patreon.com/elementalfracture",
  patchnotes: "https://docs.elefrac.com/patchnotes",
  x: "https://x.com/elefracture",
  twitch: "https://twitch.tv/elementalfracture",
  youtube: "https://youtube.com/@elementalfracture",
};

export function SocialRow() {
  return (
    <div className="social-row">
      <div className="social-group">
        <button
          className="social-btn"
          onClick={() => openLink(LINKS.discord)}
          aria-label="Connect on Discord"
        >
          <span className="social-icon social-discord" aria-hidden="true" />
          Connect
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(LINKS.donate)}
          aria-label="Donate on Patreon"
        >
          <span className="social-icon social-donate" aria-hidden="true" />
          Donate
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(LINKS.patchnotes)}
        >
          <FileText aria-hidden="true" />
          Patch notes
        </button>
      </div>

      <div className="social-group">
        <button
          className="social-btn"
          onClick={() => openLink(LINKS.x)}
          aria-label="X"
        >
          <span className="social-icon social-x" aria-hidden="true" />
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(LINKS.twitch)}
          aria-label="Twitch"
        >
          <span className="social-icon social-twitch" aria-hidden="true" />
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(LINKS.youtube)}
          aria-label="YouTube"
        >
          <span className="social-icon social-youtube" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
