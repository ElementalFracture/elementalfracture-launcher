import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { useSettings } from "@/context/SettingsContext";
import { CUSTOM_WRAPPER, type WrapperState } from "./wrapper";
import "./WrapperField.css";

/** Picks the command the game exe is run through (Linux only).
 *
 *  `onChange` is the draft, `onCommit` writes it. The picker does both at once —
 *  choosing an entry is a finished decision — while the free-text box drafts as
 *  you type and commits when you leave it, so a half-typed command never
 *  reaches disk. */
export function WrapperField({
  value,
  onChange,
  onCommit,
}: {
  value: WrapperState;
  onChange: (w: WrapperState) => void;
  onCommit: (w: WrapperState) => void;
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
            onValueChange={(v) => {
              const next: WrapperState =
                v === CUSTOM_WRAPPER
                  ? { mode: "custom", value: "" }
                  : { mode: "select", value: v };
              onChange(next);
              /* Custom… only opens the box beside it — there is nothing to
                 write until something is typed in there. */
              if (next.mode !== "custom") {
                onCommit(next);
              }
            }}
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
            onBlur={(e) => onCommit({ ...value, value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        )}
      </div>
    </div>
  );
}
