import { useState } from "react";
import { Home, Box, Info, Settings as SettingsIcon } from "lucide-react";
import { useUI, type ViewName } from "@/context/UIContext";
import { AboutModal } from "@/components/modals/AboutModal";
import "./Sidebar.css";

const NAV_ITEMS: { view: ViewName; title: string; icon: typeof Home }[] = [
  { view: "home", title: "Home", icon: Home },
  { view: "mods", title: "Game Settings", icon: Box },
  { view: "settings", title: "Launcher Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const { view, setView } = useUI();
  const [aboutOpen, setAboutOpen] = useState(false);

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
        <button className="nav-btn" title="About" onClick={() => setAboutOpen(true)}>
          <Info strokeWidth={2} />
        </button>
      </div>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </aside>
  );
}
