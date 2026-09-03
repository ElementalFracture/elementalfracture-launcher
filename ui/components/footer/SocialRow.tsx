import { FileText } from "lucide-react";
import { openLink } from "@/lib/links";
import { URLS } from "@/lib/urls";
import { _ } from "@/i18n";
import "./SocialRow.css";

export function SocialRow() {
  return (
    <div className="social-row">
      <div className="social-group">
        <button
          className="social-btn"
          onClick={() => openLink(URLS.discord)}
          aria-label={_("footer.connectTitle")}
        >
          <span className="social-icon social-discord" aria-hidden="true" />
          {_("footer.connect")}
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(URLS.donate)}
          aria-label={_("footer.donateTitle")}
        >
          <span className="social-icon social-donate" aria-hidden="true" />
          {_("footer.donate")}
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(URLS.patchnotes)}
        >
          <FileText aria-hidden="true" />
          {_("footer.patchNotes")}
        </button>
      </div>

      <div className="social-group">
        <button
          className="social-btn"
          onClick={() => openLink(URLS.x)}
          aria-label="X"
        >
          <span className="social-icon social-x" aria-hidden="true" />
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(URLS.twitch)}
          aria-label="Twitch"
        >
          <span className="social-icon social-twitch" aria-hidden="true" />
        </button>
        <button
          className="social-btn"
          onClick={() => openLink(URLS.youtube)}
          aria-label="YouTube"
        >
          <span className="social-icon social-youtube" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
