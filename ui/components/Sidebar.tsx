import { Home, Boxes, Settings as SettingsIcon } from "lucide-react";
import { useUI, type ViewName } from "@/context/UIContext";
import { openLink } from "@/lib/links";
import { DiscordIcon } from "@/assets/icons/DiscordIcon";
import "./Sidebar.css";

const LINKS = {
  discord: "https://dsc.gg/elefrac",
};

const NAV_ITEMS: { view: ViewName; title: string; icon: typeof Home }[] = [
  { view: "home", title: "Home", icon: Home },
  { view: "mods", title: "Mods & Install", icon: Boxes },
  { view: "settings", title: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const { view, setView } = useUI();

  return (
    <aside id="sidebar">
      <nav>
        {NAV_ITEMS.map(({ view: v, title, icon: Icon }) => (
          <button
            key={v}
            className={"nav-btn" + (view === v ? " active" : "")}
            title={title}
            onClick={() => setView(v)}
          >
            <Icon strokeWidth={2} />
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button
          className="nav-btn"
          title="Join the Discord"
          onClick={() => openLink(LINKS.discord)}
        >
          <DiscordIcon />
        </button>
      </div>
    </aside>
  );
}
