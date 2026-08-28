import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Switch } from "@/components/shadcn/switch";
import { InfoPopover } from "@/components/InfoPopover";
import { useSettings } from "@/context/SettingsContext";
import { useGame } from "@/context/GameContext";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import type { SettingsForm } from "./useSettingsForm";

/** Game folder plus the two window-behaviour toggles. */
export function LauncherCard({ form }: { form: SettingsForm }) {
  const { settings, saveSettings } = useSettings();
  const { refreshStatus, provisionInstall } = useGame();

  /* Change the game folder from Settings → Launcher. Saved on the spot rather
     than with the rest of the form: the install work below depends on it. */
  const onBrowseGame = async () => {
    if (!settings) {
      return;
    }
    try {
      const dir = await rust.pickGameDir("Select your Spellbreak folder");
      if (!dir) {
        return;
      }
      await saveSettings({ ...settings, game_path: dir });
      const fresh = await refreshStatus();
      if (fresh?.exe_present) {
        await provisionInstall();
      }
      toast("Game folder updated");
    } catch (e) {
      toast(String(e), true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Launcher Location</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="field">
          <Label htmlFor="game-folder">Game folder</Label>
          <div className="form-row">
            <Input
              id="game-folder"
              type="text"
              readOnly
              placeholder="Not set"
              value={settings?.game_path ?? ""}
            />
            <Button variant="secondary" onClick={onBrowseGame}>
              Browse…
            </Button>
          </div>
        </div>
        <div className="switch-row">
          <span className="switch-text">
            <span>Minimize to taskbar when closing (X)</span>
            <InfoPopover>
              <p>
                Pressing X hides the launcher to the taskbar instead of
                quitting, so it stays running in the background. Quit it fully
                from its tray/taskbar entry.
              </p>
            </InfoPopover>
          </span>
          <Switch
            aria-label="Minimize to taskbar when closing (X)"
            checked={form.minimizeOnClose}
            onCheckedChange={form.setMinimizeOnClose}
          />
        </div>
        <div className="switch-row">
          <span className="switch-text">
            <span>Close launcher when the game starts</span>
            <InfoPopover>
              <p>
                Automatically closes the launcher a moment after the game
                launches, to free up memory while you play.
              </p>
            </InfoPopover>
          </span>
          <Switch
            aria-label="Close launcher when the game starts"
            checked={form.closeOnLaunch}
            onCheckedChange={form.setCloseOnLaunch}
          />
        </div>
      </CardContent>
    </Card>
  );
}
