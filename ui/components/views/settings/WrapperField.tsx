import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { _ } from "@/i18n";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import { blurOnEnter } from "./blurOnEnter";
import { SteamProtonField } from "./SteamProtonField";
import {
  CUSTOM_WRAPPER,
  STEAM_WRAPPER,
  computeWrapperState,
  parseSteamGameId,
  type WrapperState,
} from "./wrapper";
import "./WrapperField.css";

/** Picks the command the game exe is run through (Linux only).
 *
 *  `onChange` is the draft, `onCommit` writes it. The picker does both at once —
 *  choosing an entry is a finished decision — while the free-text box drafts as
 *  you type and commits when you leave it, so a half-typed command never
 *  reaches disk.
 *
 *  "Steam" has Play start the game's Steam shortcut, by the game id in the
 *  box under it. That id is read off the shortcut when there is one
 *  (Settings → Steam adds it) and the box says so; a different id typed in
 *  stays, with the shortcut's shown beside it — click it to copy. Below sits the Proton
 *  build Steam runs that game on. */
export function WrapperField({
  value,
  onChange,
  onCommit,
}: {
  value: WrapperState;
  onChange: (w: WrapperState) => void;
  onCommit: (w: WrapperState) => void;
}) {
  const { settings, wrappers } = useSettings();
  const savedCommand = settings?.launch_command ?? "";
  /* The id of the game's Steam shortcut, when it has one. Looked up again
     each time Steam is picked, and whenever the saved command changes:
     the shortcut can be added while Settings is open, and adding it on
     Linux switches Play to it. */
  const [knownId, setKnownId] = useState<string | null>(null);
  const lookUpId = useCallback(async () => {
    try {
      const id = await rust.steamGameId();
      setKnownId(id);
      return id;
    } catch {
      return null;
    }
  }, []);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    lookUpId();
  }, [lookUpId, savedCommand]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selected =
    value.mode === "custom"
      ? CUSTOM_WRAPPER
      : value.mode === "steam"
        ? STEAM_WRAPPER
        : value.value;
  /* An id that isn't the shortcut's stays as typed, rather than being
     swapped for it behind the player's back. */
  const matchesShortcut =
    knownId !== null && parseSteamGameId(value.value) === knownId;

  const copyKnownId = async () => {
    try {
      await navigator.clipboard.writeText(knownId ?? "");
      toast(_("settings.wrapper.steamIdCopied"));
    } catch {
      toast(_("settings.wrapper.steamIdCopyFailed"), true);
    }
  };
  /* The saved id, not the box's draft: the picker reads Steam's config for
     it, which is not worth doing on every keystroke. */
  const saved = computeWrapperState(savedCommand, wrappers);
  const steamId =
    value.mode === "steam" && saved.mode === "steam" ? saved.value : null;

  const pick = async (v: string) => {
    if (v === STEAM_WRAPPER) {
      const id = await lookUpId();
      const next: WrapperState = {
        mode: "steam",
        value: id ?? (value.mode === "steam" ? value.value : ""),
      };
      onChange(next);
      // With no id to write yet, the box below asks for one.
      if (next.value) {
        onCommit(next);
      }
      return;
    }
    const next: WrapperState =
      v === CUSTOM_WRAPPER
        ? { mode: "custom", value: "" }
        : { mode: "select", value: v };
    onChange(next);
    /* "Custom…" only opens the box beside it — there is nothing to
       write until something is typed in there. */
    if (next.mode !== "custom") {
      onCommit(next);
    }
  };

  /* The Steam fields sit beside the wrapper's own field rather than inside
     it, so each gets the same spacing as any other. */
  return (
    <>
      <div className="field">
        <Label htmlFor="launch-wrapper">
          {_("settings.wrapper.command")}
          <small>{_("settings.wrapper.commandHelp")}</small>
        </Label>
        {/* The picker stays put once "Custom…" is chosen — the free-text
            box appears beside it rather than replacing it, so a detected
            wrapper can still be picked back up. */}
        <div className="form-row">
          <Select value={selected} onValueChange={(v) => pick(v as string)}>
            {/* The label points at whichever control is the live
                one; on Custom… that's the box beside it, not this. */}
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
              <SelectItem value={STEAM_WRAPPER}>
                {_("settings.wrapper.steam")}
              </SelectItem>
              <SelectItem value={CUSTOM_WRAPPER}>
                {_("settings.wrapper.custom")}
              </SelectItem>
            </SelectContent>
          </Select>
          {value.mode === "custom" && (
            <Input
              id="launch-wrapper"
              type="text"
              placeholder={_(
                wrappers.length
                  ? "settings.wrapper.placeholder"
                  : "settings.wrapper.placeholderNone"
              )}
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
              onBlur={(e) => onCommit({ ...value, value: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          )}
        </div>
      </div>
      {value.mode === "steam" && (
        <div className="field">
          <Label htmlFor="steam-game-id">
            {_("settings.wrapper.steamId")}
            <small>{_("settings.wrapper.steamIdHelp")}</small>
          </Label>
          <Input
            id="steam-game-id"
            type="text"
            inputMode="numeric"
            placeholder={_("settings.wrapper.steamIdPlaceholder")}
            value={value.value}
            onChange={(e) => onChange({ mode: "steam", value: e.target.value })}
            onBlur={(e) => onCommit({ mode: "steam", value: e.target.value })}
            onKeyDown={blurOnEnter}
          />
          {knownId &&
            (matchesShortcut ? (
              <p className="field-note">
                {_("settings.wrapper.steamIdDetected")}
              </p>
            ) : (
              <p className="field-note">
                {_("settings.wrapper.steamIdDetectedOther")}
                <button
                  type="button"
                  className="copy-id"
                  title={_("settings.wrapper.steamIdCopy")}
                  onClick={copyKnownId}
                >
                  {knownId}
                </button>
              </p>
            ))}
        </div>
      )}
      {steamId && <SteamProtonField gameId={steamId} />}
    </>
  );
}
