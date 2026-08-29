import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { blurOnEnter } from "./blurOnEnter";
import type { SettingsForm } from "./useSettingsForm";

export function UrlsCard({ form }: { form: SettingsForm }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>URLs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="field">
          <Label htmlFor="cdn-base">
            CDN base{" "}
            <small>(where game and launcher updates are pulled from)</small>
          </Label>
          <Input
            id="cdn-base"
            type="text"
            value={form.cdnBase}
            onChange={(e) => form.setCdnBase(e.target.value)}
            onBlur={(e) => form.commitText("cdn_base", e.target.value)}
            onKeyDown={blurOnEnter}
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
            onKeyDown={blurOnEnter}
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
            onKeyDown={blurOnEnter}
          />
        </div>
      </CardContent>
    </Card>
  );
}
