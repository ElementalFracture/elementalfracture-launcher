import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { InfoPopover } from "@/components/InfoPopover";
import { _, LOCALES, LOCALE_NAMES, type LanguageSetting } from "@/i18n";
import type { SettingsForm } from "./useSettingsForm";

/** Sentinel the Select uses for "System": the setting itself stores "", but
    Radix reserves the empty string for "no selection" and refuses an item
    carrying it. Same trick as CUSTOM_WRAPPER in ./wrapper. */
const SYSTEM = "__system__";

/** Picks the language the launcher speaks. Writing the setting is all it takes
    — LocaleGate reads it back out and re-renders the tree, so the choice lands
    immediately without a restart. */
export function LanguageCard({ form }: { form: SettingsForm }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{_("settings.language.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="field">
          <Label htmlFor="language">
            {_("settings.language.label")}
            <InfoPopover>
              <p>{_("settings.language.help")}</p>
            </InfoPopover>
          </Label>
          <div className="form-row">
            <Select
              value={form.language || SYSTEM}
              onValueChange={(v) =>
                form.setLanguage(v === SYSTEM ? "" : (v as LanguageSetting))
              }
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* System is stored as "", resolved against the OS at render
                    time rather than written out as a concrete tag. */}
                <SelectItem value={SYSTEM}>
                  {_("settings.language.system")}
                </SelectItem>
                {/* Each language is named in itself, so someone who has landed
                    in one they can't read can still find their way back. */}
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LOCALE_NAMES[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
