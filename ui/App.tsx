import "./App.css";
import { SettingsProvider } from "@/context/SettingsContext";
import { LocaleGate } from "@/i18n/LocaleGate";
import { GameProvider } from "@/context/GameContext";
import { LiveDataProvider } from "@/context/LiveDataContext";
import { FriendsProvider } from "@/context/FriendsContext";
import { ProgressProvider } from "@/context/ProgressContext";
import { UIProvider } from "@/context/UIContext";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { TopBar } from "@/components/topbar/TopBar";
import { Footer } from "@/components/footer/Footer";
import { HomeView } from "@/components/views/home/HomeView";
import { ModsView } from "@/components/views/mods/ModsView";
import { SettingsView } from "@/components/views/settings/SettingsView";
import { Wizard } from "@/components/Wizard";
import { LauncherUpdatePop } from "@/components/LauncherUpdatePop";
import { QuickstartNotice } from "@/components/QuickstartNotice";
import { Toaster } from "@/components/shadcn/toast";

function App() {
  return (
    <SettingsProvider>
      <GameProvider>
        <LiveDataProvider>
          <FriendsProvider>
            <ProgressProvider>
              <UIProvider>
                <LocaleGate>
                  <div id="app">
                    <Sidebar />
                    <main>
                      <TopBar />
                      <HomeView />
                      <ModsView />
                      <SettingsView />
                      <Footer />
                    </main>
                  </div>
                  <Wizard />
                  <LauncherUpdatePop />
                  <QuickstartNotice />
                </LocaleGate>
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
