import type { Settings } from "@/lib/rust";
import { DISCORD_CDN } from "@/lib/urls";

/**
 * Resolve a player's chosen avatar to an image URL, or null for the
 * initials fallback. Headshots are bundled in ui/public/avatars; the
 * "discord" sentinel resolves to the linked Discord profile picture.
 */
export function avatarUrl(settings: Settings | null): string | null {
  const av = settings?.avatar?.trim();
  if (!av) {
    return null;
  }
  if (av === "discord") {
    const id = settings?.discord_id?.trim();
    const hash = settings?.discord_avatar?.trim();
    if (id && hash) {
      const ext = hash.startsWith("a_") ? "gif" : "png";
      return `${DISCORD_CDN}/avatars/${id}/${hash}.${ext}?size=64`;
    }
    if (id) {
      // Default embed avatar for the new (pomelo) username scheme.
      let n = 0;
      try {
        n = Number(BigInt(id) % 6n);
      } catch {
        n = 0;
      }
      return `${DISCORD_CDN}/embed/avatars/${n}.png`;
    }
    return null;
  }
  // Bundled Spellbreak headshot (see ui/public/avatars/<id>.webp).
  return `/avatars/${encodeURIComponent(av)}.webp`;
}
