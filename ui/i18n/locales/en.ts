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
  /* Strings a shared component owns, rather than a view: whoever renders it
     shouldn't have to pass its own words in. */
  common: {
    moreInfo: "More info",
    /* shadcn's own chrome: a dialog's close button, the spinner, and the x on
       a toast. None are drawn — they are what a screen reader reads out. */
    close: "Close",
    loading: "Loading",
    closeToast: "Close toast",
  },

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
    steam: {
      title: "Steam",
      closeSteam: "Close Steam",
      closing: "Asking Steam to close…",
      closeFirst:
        "Close Steam to change these. Steam saves its own settings when it exits and would undo the change.",
      noUser: "Sign in to Steam once on this computer to change these.",
      link: "Play Spellbreak from Steam",
      linkHelp:
        "Pressing Play on Spellbreak in your Steam library opens this launcher. Steam treats it as Spellbreak, so its controller layouts, overlay and playtime all work. Your Elemental Fracture files stay where they are.",
      linkUnavailable:
        "Install Spellbreak in Steam first. Steam only shows Play for installed games, but the game still runs from your Elemental Fracture folder.",
      linked:
        "Pressing Play on Spellbreak in Steam now opens Elemental Fracture.",
      unlinked: "Spellbreak's Play button in Steam is back to normal.",
      quickstart: "Go straight into the game",
      quickstartHelp:
        "Pressing Play on Spellbreak in Steam starts the game without showing the launcher, using the game mode you last picked. To open the launcher instead (to switch game modes, say), hold Shift while you press Play until it appears. It also opens by itself when there's an update to install or you need to sign in.",
      shortcut: "Add Elemental Fracture to Steam",
      shortcutHelp:
        "Adds the launcher to your Steam library as a non-Steam game, with artwork, so you can give it a Steam controller layout. Use this if you don't own Spellbreak on Steam.",
      added: "Added to your Steam library.",
      removed: "Removed from your Steam library.",
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
        "(session validation endpoint; the game server host is derived from it)",
      players: "Players URL",
      playersHelp: "(players sidecar endpoint)",
    },
    reset: {
      button: "Reset settings",
      confirm: "Click again to confirm reset",
      title: "Put the settings on this page back to their defaults",
      done: "Settings reset",
    },
  },

  /* First run. `account.*` below carries the sign-in step, which is the same
     dialog the account pill opens. */
  wizard: {
    welcomeTitle: "Welcome to Elemental Fracture",
    welcomeSub: "We’re so glad you’re here.",
    next: "Next",
    gameTitle: "Have you set up the game before?",
    gameSub:
      "If Spellbreak is already on this machine, point the launcher at its folder and you’re done.",
    gameNo: "No, not yet",
    gameYes: "Yes, locate my install",
    looking: "Looking for an existing install…",
    pickFolder: "Select your Spellbreak folder (contains g3 and Engine)",
    noFolder: "No folder selected, you can set it any time in Settings.",
    /* `{step}` is the install pipeline's own line, lowercased by the caller. */
    hooked: "Hooked: {path}, {step}",
    installingMods: "installing updates & mods…",
    skip: "Skip for now",
    doneTitle: "You're all set!",
    doneTitleNamed: "You're all set, {name}!",
    doneSub: "The Hollow Lands still beckon, breaker.",
    enter: "Enter the launcher",
  },

  /* The sign-in dialog, and the wizard step that is the same form. */
  account: {
    title: "Sign in to Elemental Fracture",
    sub: "Use your Elemental Fracture email and password — the same account as the website.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    forgot: "Forgot password?",
    createOne: "Create one",
    needHelp: "Need help?",
    quickStart: "Quick-start guide",
    welcomeBack: "Welcome back, {name}!",
    /* `{role}` is one of the three below, when the account carries a badge. */
    welcomeBackAs: "Welcome back, {name} ({role})!",
    roleDev: "dev",
    roleStaff: "staff",
    roleTester: "tester",
  },

  footer: {
    connect: "Connect",
    connectTitle: "Connect on Discord",
    donate: "Donate",
    donateTitle: "Donate on Patreon",
    patchNotes: "Patch notes",
  },

  /* The pop-up in the top-right when a newer launcher is on the CDN. */
  update: {
    title: "Launcher Update Available",
    installing: "Installing…",
    ready: "v{version} ready · click to update",
    click: "Click to update",
    dismiss: "Dismiss",
  },

  /* The bar across the top: the logo, and the three pills. */
  topbar: {
    logo: "Elemental Fracture — open elefrac.com",
    logoTitle: "Open elefrac.com",
    players: {
      /* The count takes a `count` and reads "N players online": everyone
         with the game open, menus included. Keep in step with the
         website's header widget (ef-player-count.php). */
      title: "Players online: click for a breakdown",
      label: "player online",
      label_other: "players online",
      inMatch: "In a match",
      inMenus: "In the menus",
      empty: "No servers are reporting in.",
      live: "Match in progress",
      /* A region the sidecar didn't name, and a family no mode maps to. */
      other: "Other",
      /* Mode, family and build names are the game's own, kept in English
         like the balance names. */
      families: {
        battleRoyale: "Battle Royale",
        dominion: "Dominion",
        clash: "Clash",
        other: "Other",
      },
      modes: {
        solo: "Solo",
        duo: "Duo",
        squad: "Squad",
        dominion: "Dominion",
        tdm: "Team Deathmatch",
        custom: "Custom Match",
        clash: "Team Clash",
        ffa: "Free for all",
      },
      flavors: {
        classic: "Classic",
        test: "Test Build",
      },
    },
    variant: {
      group: "Game variant",
      enabling: "Enabling…",
      enable: "Enable Playtest",
      difference: "What's the difference?",
      /* Whole sentences, the balance's name included: *asterisks* mark the
         run that is drawn in bold. A translation can move that run, or drop
         the emphasis entirely, without anyone touching the component. */
      efHelp:
        "*Elemental Fracture* is the community edition: reworked talents, fresh balance and ongoing updates.",
      classicHelp:
        "*Classic* is Spellbreak as it was at shutdown: the original balance, preserved untouched.",
      playtestHelp:
        "*Playtest* is the private playtest channel: unreleased balance for testers to try before it ships.",
      /* Tooltips on the tabs. The names beside them are not translated. */
      efTitle: "Elemental Fracture Balance",
      classicTitle: "Classic Spellbreak",
      playtestTitle: "Private playtest build",
    },
    account: {
      title: "Account",
      guest: "Guest",
      signIn: "Sign in",
      sessionExpired: "Session expired",
      signOut: "Sign out",
      signedOut: "Signed out.",
      closeFriends: "Close friend list",
      /* Stands in for the account's own name in the drawer header. */
      you: "You",
      developer: "Developer",
      staff: "Staff",
      tester: "Tester",
    },
  },

  /* The drawer behind the account pill. Its own namespace rather than a corner
     of `topbar`, because FriendsContext owns half of these words. */
  friends: {
    add: "Add",
    addTitle: "Send friend request",
    addPlaceholder: "Add by Spellbreak ID (username)",
    loading: "Loading…",
    none: "No friends yet, add someone by their Spellbreak ID above.",
    /* `{n}`, not `{count}`: these are section heads with a tally, not a
       sentence about a number, so they take no plural form. */
    onlineSection: "Friends ({n})",
    onlineEmpty: "Nobody is online right now.",
    requestsSection: "Requests ({n})",
    offlineSection: "Offline ({n})",
    offlineEmpty: "No offline friends.",
    requested: "requested",
    inGame: "in game",
    online: "online",
    offline: "offline",
    remove: "Remove friend",
    accept: "Accept",
    decline: "Decline",
    cancelRequest: "Cancel request",
    /* The accessible name of a row's button, which is only an icon. */
    actionFor: "{action}: {name}",
    confirmTitle: "Remove {name} ?",
    confirmBody: "This will remove {name} from your friends list.",
    confirmCancel: "Cancel",
    confirmRemove: "Remove",
    /* Keyed by the code the friends sidecar answers with. */
    errors: {
      userNotFound: "No player with that Spellbreak ID.",
      cannotFriendSelf: "That's you!",
      sessionExpired: "Your session expired — sign in again.",
      usernameRequired: "Enter a Spellbreak ID.",
      noPendingRequest: "No pending request from them.",
      unavailable: "Friend server unavailable, try again.",
    },
  },

  /* The icon rail. Nothing on it has words of its own — these are the tooltips,
     which are also the buttons' only accessible names. */
  sidebar: {
    home: "Home",
    mods: "Game Settings",
    settings: "Launcher Settings",
    about: "About",
  },

  home: {
    /* Two lines per band of the day; `greeting()` in views/home/format.ts
       picks between them, and `fallbackName` stands in for an unset username. */
    greeting: {
      fallbackName: "breaker",
      night: "Burning the midnight oil, {name}?",
      nightAlt: "The Hollow Lands never sleep, {name}.",
      morning: "Good morning, {name}!",
      morningAlt: "Rise and cast, {name}!",
      afternoon: "Good afternoon, {name}!",
      afternoonAlt: "Perfect weather for a Spellstorm, {name}.",
      evening: "Good evening, {name}!",
      eveningAlt: "The storm rolls in at dusk, {name}.",
    },
    /* Banner copy, one title/sub pair per installed balance. */
    hero: {
      efTitle: "The Hollow Lands still beckon, breaker",
      efSub:
        "Community servers, restored battles, new balance. Spellbreak lives on.",
      classicTitle: "The Hollow Lands, as they were before.",
      classicSub:
        "Community servers, restored battles, the original balance. Spellbreak, preserved.",
      playtestTitle: "The Hollow Lands, ahead of the storm.",
      playtestSub:
        "Unreleased balance, for testers. Expect rough edges: your feedback shapes what ships.",
    },
    install: {
      noInstall:
        "No Spellbreak install configured. Locate an existing install or download the game.",
      exeMissing:
        "Spellbreak.exe was not found in the configured folder. Locate the right folder or re-download.",
      locate: "Locate existing install",
      download: "Download game…",
    },
    /* The plate and the line under it. Plate labels are set in a display face
       at 36px, so they want a word, not a phrase — `LaunchPlate` steps the
       size down as they get longer. */
    launch: {
      launch: "Launch",
      launchTitle: "Launch Spellbreak",
      updatingTitle: "Updating the game…",
      update: "Update",
      updating: "Updating",
      updateTitle: "Download game update v{version}",
      updateTitleUnknown: "Download the game update",
      downloadingTitle: "Downloading the game update…",
      hint: "Version {version} is out — update to play.",
      hintUnknown: "A game update is out — update to play.",
      patchShipped: "A game update shipped — update before you play.",
      launching: "Launching Spellbreak…",
    },
    events: {
      title: "Live events",
      live: "LIVE NOW",
      interested: "{count} interested",
      interested_other: "{count} interested",
      /* `{when}` is the date itself, which Intl formats in the same locale. */
      inMinutes: "{when} (in {minutes} min)",
      inHours: "{when} (in {hours} h)",
    },
    news: {
      title: "What’s new",
      empty: "No news right now.",
    },
    /* Pipeline stages. The backend names them on the wire in kebab-case;
       `stageLabel()` maps those names onto these keys. */
    stages: {
      downloadBase: "Downloading game",
      extractBase: "Extracting game",
      downloadPatch: "Downloading update",
      extractPatch: "Installing update",
      installMods: "Installing mods",
      downloadPlaytest: "Downloading playtest build",
      extractPlaytest: "Installing playtest build",
      done: "Done",
    },
  },

  /* The "Game & Mods" view. `game` is the Game card plus the install pipeline
     its two buttons drive — that one lives in GameContext, because Home reaches
     the same entry points — and `mods` is the card below it. */
  game: {
    title: "Game",
    version: "(v{version})",
    locate: "Locate install",
    checkUpdates: "Check for game updates",
    checking: "Checking…",
    forceUpdate: "Force latest update",
    forcing: "Updating…",
    download: "Download game…",
    location: "Install location",
    locationPlaceholder: "Not set",
    browse: "Browse…",
    save: "Save",
    noFolder: "No game folder set — Locate or Download the game.",
    /* Titles on the OS folder picker, not on a window of ours. */
    pickFolder: "Select your Spellbreak folder",
    pickDestination:
      "Choose where to install Spellbreak (approx. 25 GB needed)",
    folderSet: "Game folder set: {path}",
    folderUpdated: "Game folder updated",
    updateAvailable:
      "Game update available (v{version}) — Launch it from Home.",
    upToDate: "Game is up to date",
    unreachable:
      "Couldn't reach the update server, check the CDN base in Settings.",
    downloading: "Installing: this is a big download, leave the launcher open.",
    downloaded: "Game installed to {path}",
    downloadFailed: "Install failed: {detail}",
    /* Provisioning: bringing a freshly-pointed-at install current. */
    alreadyCurrent: "Already up to date (v{version})",
    provisioning: "Installing updates & mods…",
    provisioned: "Install ready (v{version})",
    provisionedUnknown: "Install ready",
    provisionFailed: "Couldn't update the install: {detail}",
    /* The same pipeline, driven from Home's Launch/Update plate. */
    updated: "Game updated to v{version}",
    updatedUnknown: "Game updated",
    updateFailed: "Update failed: {detail}",
  },

  mods: {
    title: "Mods",
    verify: "Verify",
    verifying: "Verifying…",
    update: "Update game",
    updating: "Updating…",
    install: "Install / Update mods",
    installing: "Installing…",
    checkingFiles: "Checking mod files…",
    installedBadge: "INSTALLED",
    missingBadge: "MISSING",
    ready: "Mods are installed and ready.",
    absent: "Mods are not installed.",
    partial: "Some mod files are missing.",
    noFolder: "Set the game folder first — use Locate or Download above.",
    missingCount:
      "{count} of {total} file missing — run Install / Update mods.",
    missingCount_other:
      "{count} of {total} files missing — run Install / Update mods.",
    patched: "Updated to v{version}",
    patchedUnknown: "Patch updated",
    installDone: "Mods installed",
    installFailed: "Install failed",
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
    archiveTooLarge:
      "This download unpacks to {size}, over the {limit} limit — it was refused rather than filling your disk. Try again; if it keeps happening, report it.",

    manifestSignatureInvalid:
      "The release manifest on the CDN isn't signed by Elemental Fracture. Nothing was installed. Try again later; if it keeps happening, report it.",
    manifestRolledBack:
      "The CDN is offering an older release list (version {offered}) than this launcher has already accepted ({seen}). Nothing was installed.",
    manifestMissingFile:
      "The release manifest has no entry for {file}, so it can't be verified. Nothing was installed.",
    downloadHashMismatch:
      "{file} didn't match its published checksum and was discarded. Try again; if it keeps happening, report it.",
    manifestUnavailable:
      "Couldn't fetch the release manifest from the CDN: {detail}",

    notSignedIn: "You're not signed in.",
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

    steamNotFound: "Steam isn't installed on this computer.",
    steamRunning:
      "Close Steam first. It saves its own settings when it exits and would undo the change.",
    steamNoUser: "Sign in to Steam once on this computer, then try again.",
    spellbreakNotInSteam:
      "Spellbreak isn't installed through Steam on this computer.",

    unsupportedLinkScheme: "Only http(s) links can be opened.",

    /* Pass-through: ours is the frame, {detail} is the library's own words. */
    io: "File error: {detail}",
    network: "Network error: {detail}",
    badArchive: "Bad archive: {detail}",
    badArchiveEntry: "Archive entry has an unusable name: {detail}",
    badJson: "Unreadable response: {detail}",
    downloadFailed: "Download failed ({url}): {detail}",
    modDownloadFailed: "Mod download failed: {detail}",
    steamConfigUnreadable:
      "Steam's {file} couldn't be read, so nothing was changed: {detail}",
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
