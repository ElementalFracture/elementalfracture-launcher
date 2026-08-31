/**
 * The source catalogue. English is the shape every other locale is checked
 * against: `fr.ts` is typed as `Catalogue`, so a missing or misspelled key is
 * a build error rather than a blank label at runtime.
 *
 * `as const` is what makes the key type literal — without it every value
 * widens to `string` and `_("…")` would take any string at all.
 *
 * Placeholders are `{name}`, filled by the second argument to `_()`. A key
 * ending in `_other` is the form the key before it takes for a count that
 * isn't one; see `pluralKey()` in ../index, which explains the name.
 */
export const en = {
  settings: {
    launcher: {
      title: "Launcher",
      version: "(v{version})",
      checkUpdates: "Check for launcher updates",
      checking: "Checking…",
      upToDate: "Launcher is up to date",
      unreachable:
        "Couldn't reach the update server, check the CDN base in Settings.",
      minimizeOnClose: "Minimize to taskbar when closing (X)",
      minimizeOnCloseHelp:
        "Pressing X hides the launcher to the taskbar instead of quitting, so it stays running in the background. Quit it fully from its tray/taskbar entry.",
      closeOnLaunch: "Close launcher when the game starts",
      closeOnLaunchHelp:
        "Automatically closes the launcher a moment after the game launches, to free up memory while you play.",
    },
    language: {
      title: "Language",
      label: "Display language",
      help: "Applies immediately. System follows your operating system, falling back to English when it isn't a language the launcher speaks.",
      system: "System",
    },
    wrapper: {
      title: "Launch wrapper",
      command: "Command",
      commandHelp: "(runs the game exe — Proton-GE recommended)",
      custom: "Custom…",
      placeholder: "e.g. umu-run",
      placeholderNone: "e.g. umu-run (none detected; install Wine or umu)",
      prefix: "Wine prefix",
      prefixHelp:
        "(optional; passed as WINEPREFIX, empty = the launcher makes its own)",
      prefixPlaceholder: "e.g. /home/you/.wineprefixes/spellbreak",
      pickPrefix: "Select a Wine prefix folder",
      browse: "Browse…",
    },
    urls: {
      title: "URLs",
      cdn: "CDN base",
      cdnHelp: "(where game and launcher updates are pulled from)",
      auth: "Auth URL",
      authHelp:
        "(token validation endpoint; the game server host is derived from it)",
      players: "Players URL",
      playersHelp: "(players sidecar endpoint)",
    },
    reset: {
      button: "Reset configuration",
      confirm: "Click again to confirm reset",
      title: "Clear all launcher settings and run first-time setup again",
      done: "Configuration reset",
    },
  },

  /* Keyed by the ErrorCode the backend sends. `errorText()` in ../errors picks
     the one that matches and fills in the params that came with it. */
  errors: {
    noGameFolder: "Set the game folder first (Settings).",
    notSpellbreakInstall:
      "That folder doesn't look like a Spellbreak install (missing g3/Binaries/Win64).",
    paksNotFound: "Paks folder not found: {path}",
    unknownVariant: "Unknown variant: {variant}",
    variantPakMissing:
      "{pak} isn't in the Paks folder: run Install / Update mods first.",
    playtestPakMissing:
      "{pak} isn't installed: enable the Playtest build to download it first.",
    noGameBinary: "No game binary found in {dir} (looked for {names})",

    modArchiveTooSmall:
      "Downloaded mod.zip is suspiciously small: the CDN may have returned an error page.",
    launcherArchiveTooSmall:
      "Downloaded launcher is suspiciously small: the CDN may have returned an error page.",
    playtestArchiveEmpty: "The playtest archive didn't contain a .pak file.",
    runtimeMissingUmu: "umu-run was not found inside the runtime archive.",
    rangeRequestsUnsupported: "The server stopped honoring range requests.",
    downloadStalled: "Download stalled (range {range}, {remaining} left).",
    launcherUpdateDisabledInDev:
      "Launcher self-update is off in dev builds (set EF_LAUNCHER_UPDATE=1).",
    extractionIncomplete:
      "Extraction incomplete: wrote {written} of {expected} files. The download is likely corrupt — delete the install folder and download again.",
    archiveMissingGameFolder:
      "Extracted files don't contain a g3 folder: unexpected archive layout.",
    runtimeArchiveCorrupt: "The runtime archive is corrupt or incomplete.",
    runtimeNeedsPython:
      "No game runtime was found and python3 is missing (umu / Proton needs it). Install python3 with your package manager, or install Wine, then try again.",
    launcherVersionUnreadable:
      "Couldn't read the launcher version from the CDN.",

    noAccountToken: "No account token set.",
    playersUrlNotConfigured: "Players URL not configured.",
    enterEmailAndPassword: "Enter your email and password.",
    signInNotConfigured: "Sign-in is not configured.",
    signInFailed: "Sign-in failed. Please try again.",
    wrongCredentials: "Wrong email or password.",
    emailUnverified: "Verify your email first, check your inbox for the code.",
    rateLimited: "Too many attempts. Please wait a few minutes.",
    accountSuspended: "This account has been suspended.",
    accountSuspendedPermanent: "This account has been permanently suspended.",
    accountSuspendedUntil:
      "This account has been suspended. The suspension will end on {ends}.",
    /* Appended on its own line when the backend sent a reason worth showing. */
    suspensionReason: "Reason: {reason}",

    wrapperNotInstalled:
      "'{wrapper}' isn't installed. Set a different Launch wrapper in Settings (e.g. wine or umu-run).",
    wrapperNotInstalledOnHost:
      "'{wrapper}' isn't installed on the host. Set a different Launch wrapper in Settings (e.g. wine or umu-run).",
    foreignWinePrefix:
      "The prefix at {prefix} was made by a different Wine, and {wrapper} would permanently convert it (possibly breaking the app that owns it). Pick an empty folder to get a fresh prefix, or clear the field to use the default.",

    unsupportedLinkScheme: "Only http(s) links can be opened.",

    /* Pass-through: ours is the frame, {detail} is the library's own words. */
    io: "File error: {detail}",
    network: "Network error: {detail}",
    badArchive: "Bad archive: {detail}",
    badArchiveEntry: "Archive entry has an unusable name: {detail}",
    badJson: "Unreadable response: {detail}",
    downloadFailed: "Download failed ({url}): {detail}",
    modDownloadFailed: "Mod download failed: {detail}",
    launchFailed: "Failed to launch ({command}): {detail}",
    signInUnreachable: "Couldn't reach the sign-in service: {detail}",
    noAppDataDir: "No app data dir available: {detail}",
    runtimeNotExecutable: "Couldn't make umu-run executable: {detail}",
    patchVersionWriteFailed:
      "Patch applied, but couldn't write version.txt: {detail}",
    launcherStageFailed: "Couldn't stage the running binary: {detail}",
    launcherInstallFailed: "Couldn't install the new binary: {detail}",
    launcherRestartFailed:
      "Updated, but couldn't restart the launcher: {detail}",
    backgroundTaskFailed: "A background task failed: {detail}",
    /* The backend sent a code this build's catalogue doesn't have — a mixed
       install, or a code added without a string. Says so rather than showing
       an empty toast. */
    unknown: "Something went wrong ({code}).",
  },
} as const;
