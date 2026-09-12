import type { Catalogue } from "../index";

/**
 * German. Typed as `Catalogue`, so leaving a key out — or inventing one —
 * fails the build rather than falling back silently at runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (Launcher, Wine, Prefix, pak, CDN,
 * umu-run, Proton) are left in English on purpose, since that is what the
 * surrounding tooling and the community's own vocabulary use.
 */
export const de: Catalogue = {
  common: {
    moreInfo: "Mehr Infos",
    close: "Schließen",
    loading: "Wird geladen",
    closeToast: "Benachrichtigung schließen",
  },

  settings: {
    launcher: {
      title: "Launcher",
      version: "(v{version})",
      checkUpdates: "Nach Launcher-Updates suchen",
      checking: "Suche läuft…",
      upToDate: "Der Launcher ist aktuell",
      unreachable:
        "Der Update-Server war nicht erreichbar, prüfe die CDN-Basis in den Einstellungen.",
      minimizeOnClose: "Beim Schließen (X) in die Taskleiste minimieren",
      minimizeOnCloseHelp:
        "X blendet den Launcher in die Taskleiste aus, statt ihn zu beenden — er läuft im Hintergrund weiter. Ganz beenden kannst du ihn über das Symbol im Infobereich bzw. in der Taskleiste.",
      closeOnLaunch: "Launcher schließen, wenn das Spiel startet",
      closeOnLaunchHelp:
        "Schließt den Launcher automatisch kurz nach dem Spielstart, damit beim Spielen Arbeitsspeicher frei wird.",
    },
    language: {
      title: "Sprache",
      label: "Anzeigesprache",
      help: "Gilt sofort. „System“ folgt deinem Betriebssystem und fällt auf Englisch zurück, wenn der Launcher diese Sprache nicht spricht.",
      system: "System",
    },
    wrapper: {
      title: "Startbefehl",
      command: "Befehl",
      commandHelp: "(startet die Spiel-EXE — Proton-GE empfohlen)",
      custom: "Benutzerdefiniert…",
      placeholder: "z. B. umu-run",
      placeholderNone:
        "z. B. umu-run (nichts gefunden; installiere Wine oder umu)",
      prefix: "Wine-Prefix",
      prefixHelp:
        "(optional; wird als WINEPREFIX übergeben, leer = der Launcher legt ein eigenes an)",
      prefixPlaceholder: "z. B. /home/du/.wineprefixes/spellbreak",
      pickPrefix: "Wähle einen Wine-Prefix-Ordner",
      browse: "Durchsuchen…",
    },
    urls: {
      title: "URLs",
      cdn: "CDN-Basis",
      cdnHelp: "(von dort kommen Spiel- und Launcher-Updates)",
      auth: "Auth-URL",
      authHelp:
        "(Endpunkt zur Sitzungsprüfung; der Spielserver-Host wird daraus abgeleitet)",
      players: "Spieler-URL",
      playersHelp: "(Endpunkt des Spielerdiensts)",
    },
    reset: {
      button: "Einstellungen zurücksetzen",
      confirm: "Zum Bestätigen erneut klicken",
      title:
        "Die Einstellungen auf dieser Seite auf die Standardwerte zurücksetzen",
      done: "Einstellungen zurückgesetzt",
    },
  },

  wizard: {
    welcomeTitle: "Willkommen bei Elemental Fracture",
    welcomeSub: "Schön, dass du da bist.",
    next: "Weiter",
    gameTitle: "Hast du das Spiel schon einmal eingerichtet?",
    gameSub:
      "Wenn Spellbreak schon auf diesem Rechner liegt, zeig dem Launcher einfach den Ordner — fertig.",
    gameNo: "Nein, noch nicht",
    gameYes: "Ja, meine Installation suchen",
    looking: "Suche nach einer vorhandenen Installation…",
    pickFolder: "Wähle deinen Spellbreak-Ordner (enthält g3 und Engine)",
    noFolder:
      "Kein Ordner ausgewählt, du kannst ihn jederzeit in den Einstellungen setzen.",
    hooked: "Gefunden: {path}, {step}",
    installingMods: "Updates & Mods werden installiert…",
    skip: "Erst mal überspringen",
    doneTitle: "Alles bereit!",
    doneTitleNamed: "Alles bereit, {name}!",
    doneSub: "Die Hollow Lands rufen noch immer, Breaker.",
    enter: "Zum Launcher",
  },

  account: {
    title: "Bei Elemental Fracture anmelden",
    sub: "Nimm deine E-Mail-Adresse und dein Passwort von Elemental Fracture — dasselbe Konto wie auf der Website.",
    email: "E-Mail",
    password: "Passwort",
    signIn: "Anmelden",
    signingIn: "Anmeldung läuft…",
    forgot: "Passwort vergessen?",
    createOne: "Eins erstellen",
    needHelp: "Brauchst du Hilfe?",
    quickStart: "Schnellstart-Anleitung",
    welcomeBack: "Willkommen zurück, {name}!",
    welcomeBackAs: "Willkommen zurück, {name} ({role})!",
    roleDev: "Dev",
    roleStaff: "Staff",
    roleTester: "Tester",
  },

  footer: {
    connect: "Beitreten",
    connectTitle: "Auf Discord beitreten",
    donate: "Spenden",
    donateTitle: "Auf Patreon spenden",
    patchNotes: "Patch Notes",
  },

  update: {
    title: "Launcher-Update verfügbar",
    installing: "Wird installiert…",
    ready: "v{version} bereit · zum Aktualisieren klicken",
    click: "Zum Aktualisieren klicken",
    dismiss: "Ausblenden",
  },

  topbar: {
    logo: "Elemental Fracture — elefrac.com öffnen",
    logoTitle: "elefrac.com öffnen",
    ingame: {
      title: "Spieler im Spiel: für die Aufschlüsselung klicken",
      label: "im Spiel",
      empty: "Niemand im Spiel",
      mode: "Modus",
      other: "Sonstige",
      /* Mode names as the community says them, like the nouns above. */
      modes: {
        solos: "Solos",
        duos: "Duos",
        squads: "Squads",
        arena: "Arena/TDM",
      },
    },
    variant: {
      group: "Spielversion",
      enabling: "Wird aktiviert…",
      enable: "Playtest aktivieren",
      difference: "Was ist der Unterschied?",
      efHelp:
        "*Elemental Fracture* ist die Community-Edition: überarbeitete Talente, neues Balancing und laufende Updates.",
      classicHelp:
        "*Classic* ist Spellbreak wie zur Abschaltung: das ursprüngliche Balancing, unangetastet bewahrt.",
      playtestHelp:
        "*Playtest* ist der private Playtest-Kanal: unveröffentlichtes Balancing, das Tester vor dem Release ausprobieren.",
      efTitle: "Elemental-Fracture-Balancing",
      classicTitle: "Spellbreak Classic",
      playtestTitle: "Privater Playtest-Build",
    },
    account: {
      title: "Konto",
      guest: "Gast",
      signIn: "Anmelden",
      sessionExpired: "Sitzung abgelaufen",
      signOut: "Abmelden",
      signedOut: "Abgemeldet.",
      closeFriends: "Freundesliste schließen",
      you: "Du",
      developer: "Entwickler",
      staff: "Staff",
      tester: "Tester",
    },
  },

  friends: {
    add: "Hinzufügen",
    addTitle: "Freundschaftsanfrage senden",
    addPlaceholder: "Über Spellbreak-ID (Benutzername) hinzufügen",
    loading: "Wird geladen…",
    none: "Noch keine Freunde, füge oben jemanden über die Spellbreak-ID hinzu.",
    onlineSection: "Freunde ({n})",
    onlineEmpty: "Gerade ist niemand online.",
    requestsSection: "Anfragen ({n})",
    offlineSection: "Offline ({n})",
    offlineEmpty: "Keine Freunde offline.",
    requested: "angefragt",
    inGame: "im Spiel",
    online: "online",
    offline: "offline",
    remove: "Freund entfernen",
    accept: "Annehmen",
    decline: "Ablehnen",
    cancelRequest: "Anfrage zurückziehen",
    actionFor: "{action}: {name}",
    confirmTitle: "{name} entfernen?",
    confirmBody: "{name} wird aus deiner Freundesliste entfernt.",
    confirmCancel: "Abbrechen",
    confirmRemove: "Entfernen",
    errors: {
      userNotFound: "Kein Spieler mit dieser Spellbreak-ID.",
      cannotFriendSelf: "Das bist du selbst!",
      sessionExpired: "Deine Sitzung ist abgelaufen – melde dich erneut an.",
      usernameRequired: "Gib eine Spellbreak-ID ein.",
      noPendingRequest: "Keine offene Anfrage von dieser Person.",
      unavailable: "Freundes-Server nicht erreichbar, versuch es noch einmal.",
    },
  },

  sidebar: {
    home: "Start",
    mods: "Spieleinstellungen",
    settings: "Launcher-Einstellungen",
    about: "Über",
  },

  home: {
    greeting: {
      fallbackName: "Breaker",
      night: "Noch spät unterwegs, {name}?",
      nightAlt: "Die Hollow Lands schlafen nie, {name}.",
      morning: "Guten Morgen, {name}!",
      morningAlt: "Aufstehen und zaubern, {name}!",
      afternoon: "Guten Tag, {name}!",
      afternoonAlt: "Perfektes Wetter für einen Zaubersturm, {name}.",
      evening: "Guten Abend, {name}!",
      eveningAlt: "Der Sturm zieht bei Einbruch der Nacht auf, {name}.",
    },
    hero: {
      efTitle: "Die Hollow Lands rufen noch immer, Breaker",
      efSub:
        "Community-Server, wiederhergestellte Schlachten, neues Balancing. Spellbreak lebt weiter.",
      classicTitle: "Die Hollow Lands, so wie sie einmal waren.",
      classicSub:
        "Community-Server, wiederhergestellte Schlachten, das ursprüngliche Balancing. Spellbreak, bewahrt.",
      playtestTitle: "Die Hollow Lands, dem Sturm voraus.",
      playtestSub:
        "Unveröffentlichtes Balancing, für Tester. Rechne mit Ecken und Kanten: Dein Feedback formt, was erscheint.",
    },
    install: {
      noInstall:
        "Keine Spellbreak-Installation eingerichtet. Suche eine vorhandene Installation oder lade das Spiel herunter.",
      exeMissing:
        "Spellbreak.exe wurde im eingestellten Ordner nicht gefunden. Wähle den richtigen Ordner oder lade das Spiel erneut herunter.",
      locate: "Vorhandene Installation suchen",
      download: "Spiel herunterladen…",
    },
    launch: {
      launch: "Starten",
      launchTitle: "Spellbreak starten",
      updatingTitle: "Das Spiel wird aktualisiert…",
      update: "Update",
      updating: "Update läuft",
      updateTitle: "Spiel-Update v{version} herunterladen",
      updateTitleUnknown: "Das Spiel-Update herunterladen",
      downloadingTitle: "Spiel-Update wird heruntergeladen…",
      hint: "Version {version} ist da — aktualisiere, um zu spielen.",
      hintUnknown: "Ein Spiel-Update ist da — aktualisiere, um zu spielen.",
      patchShipped:
        "Ein Spiel-Update ist erschienen — aktualisiere vor dem Spielen.",
      launching: "Spellbreak wird gestartet…",
    },
    events: {
      title: "Live-Events",
      live: "JETZT LIVE",
      interested: "{count} interessiert",
      interested_other: "{count} interessiert",
      inMinutes: "{when} (in {minutes} Min.)",
      inHours: "{when} (in {hours} Std.)",
    },
    news: {
      title: "Neuigkeiten",
      empty: "Gerade keine Neuigkeiten.",
    },
    stages: {
      downloadBase: "Spiel wird heruntergeladen",
      extractBase: "Spiel wird entpackt",
      downloadPatch: "Update wird heruntergeladen",
      extractPatch: "Update wird installiert",
      installMods: "Mods werden installiert",
      downloadPlaytest: "Playtest-Build wird heruntergeladen",
      extractPlaytest: "Playtest-Build wird installiert",
      done: "Fertig",
    },
  },

  game: {
    title: "Spiel",
    version: "(v{version})",
    locate: "Installation suchen",
    checkUpdates: "Nach Spiel-Updates suchen",
    checking: "Suche läuft…",
    forceUpdate: "Neuestes Update erzwingen",
    forcing: "Wird aktualisiert…",
    download: "Spiel herunterladen…",
    location: "Installationsordner",
    locationPlaceholder: "Nicht gesetzt",
    browse: "Durchsuchen…",
    save: "Speichern",
    noFolder:
      "Kein Spielordner gesetzt — nutze Suchen oder lade das Spiel herunter.",
    pickFolder: "Wähle deinen Spellbreak-Ordner",
    pickDestination:
      "Wähle, wohin Spellbreak installiert wird (ca. 25 GB nötig)",
    folderSet: "Spielordner gesetzt: {path}",
    folderUpdated: "Spielordner aktualisiert",
    updateAvailable:
      "Spiel-Update verfügbar (v{version}) — starte es auf der Startseite.",
    upToDate: "Das Spiel ist aktuell",
    unreachable:
      "Der Update-Server war nicht erreichbar, prüfe die CDN-Basis in den Einstellungen.",
    downloading:
      "Installation läuft: der Download ist groß, lass den Launcher offen.",
    downloaded: "Spiel installiert in {path}",
    downloadFailed: "Installation fehlgeschlagen: {detail}",
    alreadyCurrent: "Schon aktuell (v{version})",
    provisioning: "Updates & Mods werden installiert…",
    provisioned: "Installation bereit (v{version})",
    provisionedUnknown: "Installation bereit",
    provisionFailed:
      "Die Installation konnte nicht aktualisiert werden: {detail}",
    updated: "Spiel auf v{version} aktualisiert",
    updatedUnknown: "Spiel aktualisiert",
    updateFailed: "Update fehlgeschlagen: {detail}",
  },

  mods: {
    title: "Mods",
    verify: "Prüfen",
    verifying: "Wird geprüft…",
    update: "Spiel aktualisieren",
    updating: "Update läuft…",
    install: "Mods installieren / aktualisieren",
    installing: "Wird installiert…",
    checkingFiles: "Mod-Dateien werden geprüft…",
    installedBadge: "INSTALLIERT",
    missingBadge: "FEHLT",
    ready: "Die Mods sind installiert und bereit.",
    absent: "Die Mods sind nicht installiert.",
    partial: "Einige Mod-Dateien fehlen.",
    noFolder:
      "Setze zuerst den Spielordner — nutze oben Suchen oder Herunterladen.",
    missingCount:
      "{count} von {total} Datei fehlt — führe Mods installieren / aktualisieren aus.",
    missingCount_other:
      "{count} von {total} Dateien fehlen — führe Mods installieren / aktualisieren aus.",
    patched: "Auf v{version} aktualisiert",
    patchedUnknown: "Patch aktualisiert",
    installDone: "Mods installiert",
    installFailed: "Installation fehlgeschlagen",
  },

  errors: {
    noGameFolder: "Setze zuerst den Spielordner (Einstellungen).",
    notSpellbreakInstall:
      "Dieser Ordner sieht nicht nach einer Spellbreak-Installation aus (g3/Binaries/Win64 fehlt).",
    paksNotFound: "Paks-Ordner nicht gefunden: {path}",
    unknownVariant: "Unbekannte Variante: {variant}",
    variantPakMissing:
      "{pak} liegt nicht im Paks-Ordner: führe zuerst Mods installieren / aktualisieren aus.",
    playtestPakMissing:
      "{pak} ist nicht installiert: aktiviere zuerst den Playtest-Build, um es herunterzuladen.",
    noGameBinary:
      "Keine Spieldatei in {dir} gefunden (gesucht wurde nach {names})",

    modArchiveTooSmall:
      "Die heruntergeladene mod.zip ist verdächtig klein: das CDN hat womöglich eine Fehlerseite geliefert.",
    launcherArchiveTooSmall:
      "Der heruntergeladene Launcher ist verdächtig klein: das CDN hat womöglich eine Fehlerseite geliefert.",
    playtestArchiveEmpty: "Das Playtest-Archiv enthielt keine .pak-Datei.",
    runtimeMissingUmu: "umu-run war nicht im Runtime-Archiv enthalten.",
    rangeRequestsUnsupported:
      "Der Server akzeptiert keine Range-Anfragen mehr.",
    downloadStalled: "Download hängt (Bereich {range}, {remaining} übrig).",
    launcherUpdateDisabledInDev:
      "Das Selbst-Update des Launchers ist in Dev-Builds aus (setze EF_LAUNCHER_UPDATE=1).",
    extractionIncomplete:
      "Entpacken unvollständig: {written} von {expected} Dateien geschrieben. Der Download ist vermutlich beschädigt — lösche den Installationsordner und lade erneut herunter.",
    archiveMissingGameFolder:
      "Die entpackten Dateien enthalten keinen g3-Ordner: unerwarteter Archivaufbau.",
    runtimeArchiveCorrupt:
      "Das Runtime-Archiv ist beschädigt oder unvollständig.",
    runtimeNeedsPython:
      "Es wurde keine Spiel-Runtime gefunden und python3 fehlt (umu / Proton braucht es). Installiere python3 über deine Paketverwaltung oder installiere Wine, und versuch es dann noch einmal.",
    launcherVersionUnreadable:
      "Die Launcher-Version konnte nicht vom CDN gelesen werden.",
    archiveTooLarge:
      "Dieser Download entpackt sich zu {size} und liegt damit über dem Limit von {limit} — er wurde abgelehnt, statt deine Festplatte zu füllen. Versuche es erneut; wenn es weiter passiert, melde es.",

    manifestSignatureInvalid:
      "Das Release-Manifest auf dem CDN ist nicht von Elemental Fracture signiert. Es wurde nichts installiert. Versuche es später erneut; falls es weiterhin passiert, melde es.",
    manifestRolledBack:
      "Das CDN bietet eine ältere Release-Liste (Version {offered}) an als die, die dieser Launcher bereits akzeptiert hat ({seen}). Es wurde nichts installiert.",
    manifestMissingFile:
      "Das Release-Manifest enthält keinen Eintrag für {file}, daher kann die Datei nicht geprüft werden. Es wurde nichts installiert.",
    downloadHashMismatch:
      "{file} stimmt nicht mit der veröffentlichten Prüfsumme überein und wurde verworfen. Versuche es erneut; falls es weiterhin passiert, melde es.",
    manifestUnavailable:
      "Das Release-Manifest konnte nicht vom CDN geladen werden: {detail}",

    notSignedIn: "Du bist nicht angemeldet.",
    playersUrlNotConfigured: "Die Spieler-URL ist nicht konfiguriert.",
    enterEmailAndPassword: "Gib deine E-Mail-Adresse und dein Passwort ein.",
    signInNotConfigured: "Die Anmeldung ist nicht konfiguriert.",
    signInFailed: "Anmeldung fehlgeschlagen. Bitte versuch es noch einmal.",
    wrongCredentials: "Falsche E-Mail-Adresse oder falsches Passwort.",
    emailUnverified:
      "Bestätige zuerst deine E-Mail-Adresse, der Code liegt in deinem Posteingang.",
    rateLimited: "Zu viele Versuche. Bitte warte ein paar Minuten.",
    accountSuspended: "Dieses Konto wurde gesperrt.",
    accountSuspendedPermanent: "Dieses Konto wurde dauerhaft gesperrt.",
    accountSuspendedUntil:
      "Dieses Konto wurde gesperrt. Die Sperre endet am {ends}.",
    suspensionReason: "Grund: {reason}",

    wrapperNotInstalled:
      "„{wrapper}“ ist nicht installiert. Wähle in den Einstellungen einen anderen Startbefehl (z. B. wine oder umu-run).",
    wrapperNotInstalledOnHost:
      "„{wrapper}“ ist auf dem Host nicht installiert. Wähle in den Einstellungen einen anderen Startbefehl (z. B. wine oder umu-run).",
    foreignWinePrefix:
      "Das Prefix unter {prefix} stammt von einem anderen Wine, und {wrapper} würde es dauerhaft umwandeln (womöglich zum Schaden der Anwendung, der es gehört). Wähle einen leeren Ordner für ein frisches Prefix, oder leere das Feld, um das Standard-Prefix zu nutzen.",

    unsupportedLinkScheme: "Es lassen sich nur http(s)-Links öffnen.",

    io: "Dateifehler: {detail}",
    network: "Netzwerkfehler: {detail}",
    badArchive: "Ungültiges Archiv: {detail}",
    badArchiveEntry:
      "Ein Archiveintrag hat einen unbrauchbaren Namen: {detail}",
    badJson: "Unlesbare Antwort: {detail}",
    downloadFailed: "Download fehlgeschlagen ({url}): {detail}",
    modDownloadFailed: "Mod-Download fehlgeschlagen: {detail}",
    launchFailed: "Start fehlgeschlagen ({command}): {detail}",
    signInUnreachable: "Der Anmeldedienst war nicht erreichbar: {detail}",
    noAppDataDir: "Kein App-Datenverzeichnis verfügbar: {detail}",
    runtimeNotExecutable:
      "umu-run konnte nicht ausführbar gemacht werden: {detail}",
    patchVersionWriteFailed:
      "Patch angewendet, aber version.txt konnte nicht geschrieben werden: {detail}",
    launcherStageFailed:
      "Die laufende Programmdatei konnte nicht beiseitegelegt werden: {detail}",
    launcherInstallFailed:
      "Die neue Programmdatei konnte nicht installiert werden: {detail}",
    launcherRestartFailed:
      "Aktualisiert, aber der Launcher konnte nicht neu starten: {detail}",
    backgroundTaskFailed:
      "Eine Hintergrundaufgabe ist fehlgeschlagen: {detail}",
    unknown: "Etwas ist schiefgelaufen ({code}).",
  },
};
