import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { _ } from "@/i18n";
import { blurOnEnter } from "./blurOnEnter";
import type { SettingsForm } from "./useSettingsForm";

export function UrlsCard({ form }: { form: SettingsForm }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{_("settings.urls.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="field">
          <Label htmlFor="cdn-base">
            {_("settings.urls.cdn")} <small>{_("settings.urls.cdnHelp")}</small>
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
            {_("settings.urls.auth")}{" "}
            <small>{_("settings.urls.authHelp")}</small>
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
            {_("settings.urls.players")}{" "}
            <small>{_("settings.urls.playersHelp")}</small>
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
