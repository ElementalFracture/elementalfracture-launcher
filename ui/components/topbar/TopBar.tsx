import logoFull from "@/assets/logo-full.png";
import { InGamePill } from "./InGamePill";
import { AccountPill } from "./AccountPill";
import { GameVariantPill } from "./GameVariantPill";
import "./TopBar.css";

export function TopBar() {
  return (
    <header id="topbar">
      <img src={logoFull} alt="Elemental Fracture" id="topbar-logo" />
      <div className="top-pills">
        <GameVariantPill />
        <InGamePill />
        <AccountPill />
      </div>
    </header>
  );
}
