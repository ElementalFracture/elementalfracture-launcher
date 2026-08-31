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
import { _ } from "@/i18n";
import { blurOnEnter } from "./blurOnEnter";
import { WrapperField } from "./WrapperField";
import type { SettingsForm } from "./useSettingsForm";

export function WrapperCard({ form }: { form: SettingsForm }) {
  const onBrowsePrefix = async () => {
    const dir = await rust.pickGameDir(_("settings.wrapper.pickPrefix"));
    if (dir) {
      // A picked folder is a finished edit: no blur is coming to write it.
      form.setWinePrefix(dir);
      form.commitText("wine_prefix", dir);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{_("settings.wrapper.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <WrapperField
          value={form.wrapper}
          onChange={form.setWrapper}
          onCommit={form.commitWrapper}
        />

        <div className="field">
          <Label htmlFor="wine-prefix">
            {_("settings.wrapper.prefix")}{" "}
            <small>{_("settings.wrapper.prefixHelp")}</small>
          </Label>
          <div className="form-row">
            <Input
              id="wine-prefix"
              type="text"
              placeholder={_("settings.wrapper.prefixPlaceholder")}
              value={form.winePrefix}
              onChange={(e) => form.setWinePrefix(e.target.value)}
              onBlur={(e) => form.commitText("wine_prefix", e.target.value)}
              onKeyDown={blurOnEnter}
            />
            <Button variant="secondary" onClick={onBrowsePrefix}>
              {_("settings.wrapper.browse")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
