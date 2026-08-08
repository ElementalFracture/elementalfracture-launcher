import "./App.css";
import "./styles.css";
import { SettingsProvider } from "@/context/SettingsContext";
import { GameProvider } from "@/context/GameContext";
import { LiveDataProvider } from "@/context/LiveDataContext";
import { FriendsProvider } from "@/context/FriendsContext";
import { ProgressProvider } from "@/context/ProgressContext";
import { UIProvider } from "@/context/UIContext";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TopBar } from "@/components/topbar/TopBar";
import { HomeView } from "@/components/views/home/HomeView";
import { ModsView } from "@/components/views/mods/ModsView";
import { SettingsView } from "@/components/views/settings/SettingsView";
import { Wizard } from "@/components/Wizard";
import { UpdatePops } from "@/components/UpdatePops";
import { Toaster } from "@/components/ui/toast";

function App() {
  return (
    <SettingsProvider>
      <GameProvider>
        <LiveDataProvider>
          <FriendsProvider>
            <ProgressProvider>
              <UIProvider>
                <div id="app">
                  <Sidebar />
                  <main>
                    <TopBar />
                    <HomeView />
                    <ModsView />
                    <SettingsView />
                  </main>
                </div>
                <Wizard />
                <UpdatePops />
                <Toaster />
              </UIProvider>
            </ProgressProvider>
          </FriendsProvider>
        </LiveDataProvider>
      </GameProvider>
    </SettingsProvider>
  );
}

export default App;
