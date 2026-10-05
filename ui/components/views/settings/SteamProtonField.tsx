import { useEffect, useState } from "react";
import { Label } from "@/components/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import type { ProtonOption } from "@/generated/bindings";
import { _ } from "@/i18n";
import { toastError } from "@/i18n/errors";
import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";

/** Sentinel for "Steam's default": nothing forced on the game. */
const STEAM_DEFAULT = "__default__";

/** Picks the Proton build Steam runs the game on, under the wrapper's Steam
 *  option. This is Steam's own per-game compatibility setting, read and
 *  written straight in Steam's config — so it needs Steam closed to change,
 *  and the backend says so when it isn't. */
export function SteamProtonField({ gameId }: { gameId: string }) {
  const [tools, setTools] = useState<ProtonOption[]>([]);
  /* undefined = still reading, null = Steam's default. */
  const [current, setCurrent] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    rust
      .steamCompatTools()
      .then((t) => live && setTools(t))
      .catch(() => live && setTools([]));
    rust
      .steamCompatTool(gameId)
      .then((t) => live && setCurrent(t))
      .catch(() => live && setCurrent(null));
    return () => {
      live = false;
    };
  }, [gameId]);

  const pick = async (v: string) => {
    const tool = v === STEAM_DEFAULT ? "" : v;
    try {
      await rust.steamSetCompatTool(gameId, tool);
      setCurrent(tool || null);
      toast(_("settings.wrapper.steamProtonSet"));
    } catch (e) {
      toastError(e);
    }
  };

  if (current === undefined) {
    return null;
  }
  // A tool Steam has on the game that isn't installed here any more.
  const unknown = current !== null && !tools.some((t) => t.tool === current);

  return (
    <div className="field">
      <Label htmlFor="steam-proton">
        {_("settings.wrapper.steamProton")}
        <small>{_("settings.wrapper.steamProtonHelp")}</small>
      </Label>
      <div className="form-row">
        <Select
          value={current ?? STEAM_DEFAULT}
          onValueChange={(v) => pick(v as string)}
        >
          <SelectTrigger id="steam-proton">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STEAM_DEFAULT}>
              {_("settings.wrapper.steamProtonDefault")}
            </SelectItem>
            {tools.map((t) => (
              <SelectItem key={t.path} value={t.tool ?? t.path}>
                {t.label}
              </SelectItem>
            ))}
            {unknown && <SelectItem value={current}>{current}</SelectItem>}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
