import { useState } from "react";
import { Home, Box, Info, Settings as SettingsIcon } from "lucide-react";
import { useUI, type ViewName } from "@/context/UIContext";
import { AboutModal } from "@/components/modals/AboutModal";
import { _, type Key } from "@/i18n";
import "./Sidebar.css";

/* The catalogue key, not the words: a module constant is built once at import,
   so a title translated here would still be in the launcher's opening language
   after a switch. `_` is called in the render below instead. */
const NAV_ITEMS: { view: ViewName; title: Key; icon: typeof Home }[] = [
  { view: "home", title: "sidebar.home", icon: Home },
  { view: "mods", title: "sidebar.mods", icon: Box },
  { view: "settings", title: "sidebar.settings", icon: SettingsIcon },
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
            title={_(title)}
            onClick={() => setView(v)}
          >
            <Icon strokeWidth={2} />
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <button
          className="nav-btn"
          title={_("sidebar.about")}
          onClick={() => setAboutOpen(true)}
        >
          <Info strokeWidth={2} />
        </button>
      </div>

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </aside>
  );
}
