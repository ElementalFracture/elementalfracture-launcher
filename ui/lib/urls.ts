/**
 * Every address the launcher can send someone to.
 *
 * These are destinations for `openLink` — pages that open in the user's own
 * browser.
 * What is deliberately *not* here: the endpoints the launcher talks to. The
 * CDN, auth, login and players URLs are settings, defaulted in
 * `src-tauri/src/settings.rs` (differently for debug and release builds) and
 * editable in Settings → Advanced — so the backend owns them, and a copy here
 * would be a second answer to the same question.
 */

/** The account website: sign-up, password reset, docs, patch notes, legal. */
const SITE = "https://elefrac.com";

export const URLS = {
  /** The site's front page — what the top bar's logo opens. */
  site: SITE,
  register: `${SITE}/register`,
  reset: `${SITE}/reset`,
  quickStart: `${SITE}/docs/quick-start-guide`,
  patchnotes: `${SITE}/patchnotes`,

  /* The three the About dialog lists. Their wording is a legal position, so
     the labels beside them stay in English — see AboutModal. */
  privacy: `${SITE}/legal/privacy-policy`,
  terms: `${SITE}/legal/terms-of-service`,
  legalStatus: `${SITE}/legal/legal-status`,

  /* Off-site: the community, and the places it is announced to. */
  discord: "https://dsc.gg/elefrac",
  donate: "https://patreon.com/elementalfracture",
  x: "https://x.com/elefracture",
  twitch: "https://twitch.tv/elementalfracture",
  youtube: "https://youtube.com/@elementalfracture",
} as const;

/** Discord's image host, where a linked account's avatar is fetched from.
    A base rather than a finished URL: `avatarUrl` builds the rest out of the
    account's snowflake and avatar hash. */
export const DISCORD_CDN = "https://cdn.discordapp.com";
