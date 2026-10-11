import * as rust from "@/lib/rust";
import { toast } from "@/lib/toast";
import { _ } from "@/i18n";

/**
 * Check a game folder before the launcher installs to it or runs from it
 * (see game/folder.rs). A Steam or Epic copy and a folder inside OneDrive are
 * refused; a folder the player can't write to is repaired where possible, or
 * the player is offered a restart as administrator.
 *
 * Returns null when the folder is fine to use, else the sentence to show.
 * An empty string means the launcher is restarting and there is nothing to say.
 */
export async function vetGameFolder(dir: string): Promise<string | null> {
  const c = await rust.checkGameFolder(dir, true, {
    title: _("folder.adminTitle"),
    message: _("folder.adminMessage", { path: dir }),
  });
  switch (c.verdict) {
    case "ok":
      if (c.fixed) {
        toast(_("folder.fixed"));
      }
      return null;
    case "storeCopy":
      return c.store === "epic" ? _("folder.epicCopy") : _("folder.steamCopy");
    case "oneDrive":
      return _("folder.oneDrive");
    case "notWritable":
      return c.restarting
        ? ""
        : _("folder.notWritable", { path: c.path ?? dir });
    default:
      return null;
  }
}
