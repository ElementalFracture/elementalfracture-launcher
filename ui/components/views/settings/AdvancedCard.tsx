import type React from "react";
import { Button } from "@/components/shadcn/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import * as rust from "@/lib/rust";
import { isWindows } from "@/lib/platform";
import { WrapperField } from "./WrapperField";
import type { SettingsForm } from "./useSettingsForm";

/** Developer and debug settings, hidden behind the warning gate. */
export function AdvancedCard({ form }: { form: SettingsForm }) {
  const onBrowsePrefix = async () => {
    const dir = await rust.pickGameDir("Select a Wine prefix folder");
    if (dir) {
      // A picked folder is a finished edit: no blur is coming to write it.
      form.setWinePrefix(dir);
      form.commitText("wine_prefix", dir);
    }
  };

  /* Nothing here has a Save behind it — a field is saved when you leave it */
  const enterBlurs = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced</CardTitle>
      </CardHeader>
      <CardContent>
        {!isWindows && (
          <WrapperField
            value={form.wrapper}
            onChange={form.setWrapper}
            onCommit={form.commitWrapper}
          />
        )}

        {!isWindows && (
          <div className="field">
            <Label htmlFor="wine-prefix">
              Wine prefix{" "}
              <small>
                (optional; passed as <code>WINEPREFIX</code>, empty = the
                launcher makes its own)
              </small>
            </Label>
            <div className="form-row">
              <Input
                id="wine-prefix"
                type="text"
                placeholder="e.g. /home/you/.wineprefixes/spellbreak"
                value={form.winePrefix}
                onChange={(e) => form.setWinePrefix(e.target.value)}
                onBlur={(e) => form.commitText("wine_prefix", e.target.value)}
                onKeyDown={enterBlurs}
              />
              <Button variant="secondary" onClick={onBrowsePrefix}>
                Browse…
              </Button>
            </div>
          </div>
        )}

        <div className="field">
          <Label htmlFor="cdn-base">CDN base</Label>
          <Input
            id="cdn-base"
            type="text"
            value={form.cdnBase}
            onChange={(e) => form.setCdnBase(e.target.value)}
            onBlur={(e) => form.commitText("cdn_base", e.target.value)}
            onKeyDown={enterBlurs}
          />
        </div>
        <div className="field">
          <Label htmlFor="auth-url">
            Auth URL{" "}
            <small>
              (token validation endpoint; the game server host is derived from
              it)
            </small>
          </Label>
          <Input
            id="auth-url"
            type="text"
            placeholder="https://play.elefrac.com/auth"
            value={form.authUrl}
            onChange={(e) => form.setAuthUrl(e.target.value)}
            onBlur={(e) => form.commitText("auth_url", e.target.value)}
            onKeyDown={enterBlurs}
          />
        </div>
        <div className="field">
          <Label htmlFor="players-url">
            Players URL <small>(players sidecar endpoint)</small>
          </Label>
          <Input
            id="players-url"
            type="text"
            placeholder="http://play.elefrac.com:4950/players"
            value={form.playersUrl}
            onChange={(e) => form.setPlayersUrl(e.target.value)}
            onBlur={(e) => form.commitText("players_url", e.target.value)}
            onKeyDown={enterBlurs}
          />
        </div>
      </CardContent>
    </Card>
  );
}
