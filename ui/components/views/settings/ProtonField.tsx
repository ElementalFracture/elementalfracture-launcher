import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { useSettings } from "@/context/SettingsContext";
import { _ } from "@/i18n";
import { AUTO_PROTON } from "./wrapper";

/** Picks the Proton build umu-run runs the game on (PROTONPATH).
 *
 *  "Automatic" writes "" and leaves the choice to the launcher. A saved build
 *  that is no longer installed stays on the list, marked, rather than the
 *  picker quietly showing something else: the launch falls back to Automatic
 *  for it, and this says so. */
export function ProtonField({
  value,
  onChange,
}: {
  value: string;
  onChange: (path: string) => void;
}) {
  const { protons } = useSettings();
  const missing = value !== "" && !protons.some((p) => p.path === value);

  return (
    <div className="field">
      <Label htmlFor="proton-build">
        {_("settings.wrapper.proton")}
        <small>{_("settings.wrapper.protonHelp")}</small>
      </Label>
      <div className="form-row">
        <Select
          value={value || AUTO_PROTON}
          onValueChange={(v) =>
            onChange(v === AUTO_PROTON ? "" : (v as string))
          }
        >
          <SelectTrigger id="proton-build">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AUTO_PROTON}>
              {_("settings.wrapper.protonAuto")}
            </SelectItem>
            {protons.map((p) => (
              <SelectItem key={p.path} value={p.path}>
                {p.label}
              </SelectItem>
            ))}
            {missing && (
              <SelectItem value={value}>
                {_("settings.wrapper.protonMissing", { path: value })}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
