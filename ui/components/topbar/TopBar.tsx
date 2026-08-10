import logoFull from "@/assets/logo-full.png";
import { InGamePill } from "./InGamePill";
import { AccountPill } from "./AccountPill";
import "./TopBar.css";

/** The header row: logo on the left, the pill strip on the right. */
export function TopBar() {
  return (
    <header id="topbar">
      <img src={logoFull} alt="Elemental Fracture" id="topbar-logo" />
      <div className="top-pills">
        <InGamePill />
        <AccountPill />
      </div>
    </header>
  );
}
