import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/context/SettingsContext";
import { CUSTOM_WRAPPER, type WrapperState } from "./wrapper";
import "./WrapperField.css";

/** Picks the command the game exe is run through (Linux only). */
export function WrapperField({
  value,
  onChange,
}: {
  value: WrapperState;
  onChange: (w: WrapperState) => void;
}) {
  const { wrappers } = useSettings();

  return (
    <div className="field">
      <Label htmlFor="launch-wrapper">
        Launch wrapper{" "}
        <small>(Linux only; runs the game exe — Proton-GE recommended)</small>
      </Label>
      {/* The picker stays put once "Custom…" is chosen — the free-text
          box appears beside it rather than replacing it, so a detected
          wrapper can still be picked back up. */}
      <div className="form-row">
        {wrappers.length > 0 && (
          <Select
            value={value.mode === "custom" ? CUSTOM_WRAPPER : value.value}
            onValueChange={(v) =>
              onChange(
                v === CUSTOM_WRAPPER
                  ? { mode: "custom", value: "" }
                  : { mode: "select", value: v }
              )
            }
          >
            {/* The label points at whichever control is the live
                one; on Custom… that's the box below, not this. */}
            <SelectTrigger
              id={value.mode === "custom" ? undefined : "launch-wrapper"}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {wrappers.map((w) => (
                <SelectItem key={w.command} value={w.command}>
                  {w.label}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM_WRAPPER}>Custom…</SelectItem>
            </SelectContent>
          </Select>
        )}
        {(value.mode === "custom" || wrappers.length === 0) && (
          <Input
            id="launch-wrapper"
            type="text"
            placeholder={
              wrappers.length
                ? "e.g. umu-run"
                : "e.g. umu-run (none detected; install Wine or umu)"
            }
            value={value.value}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
