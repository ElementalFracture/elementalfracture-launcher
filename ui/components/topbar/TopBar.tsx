import logoFull from "@/assets/logo-full.png";
import { openLink } from "@/lib/links";
import { InGamePill } from "./InGamePill";
import { AccountPill } from "./AccountPill";
import { GameVariantPill } from "./GameVariantPill";
import "./TopBar.css";

const SITE = "https://elefrac.com";

export function TopBar() {
  return (
    <header id="topbar">
      {/* A button, not an <a>: a real link would navigate the webview itself
          away from the launcher. openLink hands it to the browser instead. */}
      <button
        id="topbar-logo"
        onClick={() => openLink(SITE)}
        aria-label="Elemental Fracture — open elefrac.com"
        title="Open elefrac.com"
      >
        <img src={logoFull} alt="" draggable={false} />
      </button>
      <div className="top-pills">
        <GameVariantPill />
        <InGamePill />
        <AccountPill />
      </div>
    </header>
  );
}
