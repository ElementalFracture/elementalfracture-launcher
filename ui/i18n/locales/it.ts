import type { Catalogue } from "../index";

/**
 * Italian. Typed as `Catalogue`, so leaving a key out — or inventing one —
 * fails the build rather than falling back silently at runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (launcher, Wine, prefix, pak, CDN,
 * umu-run, Proton) are left in English on purpose, since that is what the
 * surrounding tooling and the community's own vocabulary use.
 */
export const it: Catalogue = {
  common: {
    moreInfo: "Altre informazioni",
    close: "Chiudi",
    loading: "Caricamento",
    closeToast: "Chiudi la notifica",
  },

  settings: {
    launcher: {
      title: "Launcher",
      version: "(v{version})",
      checkUpdates: "Cerca aggiornamenti del launcher",
      checking: "Ricerca…",
      upToDate: "Il launcher è aggiornato",
      unreachable:
        "Impossibile raggiungere il server degli aggiornamenti, controlla la base CDN nelle Impostazioni.",
      minimizeOnClose:
        "Riduci a icona nella barra delle applicazioni alla chiusura (X)",
      minimizeOnCloseHelp:
        "Premere X nasconde il launcher nella barra delle applicazioni invece di chiuderlo, così resta in esecuzione in background. Per chiuderlo del tutto usa la sua icona nell'area di notifica o nella barra.",
      closeOnLaunch: "Chiudi il launcher all'avvio del gioco",
      closeOnLaunchHelp:
        "Chiude automaticamente il launcher poco dopo l'avvio del gioco, per liberare memoria mentre giochi.",
    },
    steam: {
      title: "Steam",
      closeSteam: "Chiudi Steam",
      closing: "Richiesta di chiusura inviata a Steam…",
      closeFirst: "Chiudi Steam per modificare queste opzioni. Steam salva le proprie impostazioni all'uscita e annullerebbe la modifica.",
      noUser: "Accedi a Steam almeno una volta su questo computer per modificare queste opzioni.",
      link: "Gioca a Spellbreak da Steam",
      linkHelp: "Premendo Gioca su Spellbreak nella tua libreria di Steam si apre questo launcher. Steam lo tratta come Spellbreak, quindi configurazioni del controller, overlay e tempo di gioco funzionano. I tuoi file di Elemental Fracture restano dove sono.",
      linkUnavailable: "Installa prima Spellbreak su Steam. Steam mostra Gioca solo per i giochi installati, ma il gioco continua ad avviarsi dalla tua cartella di Elemental Fracture.",
      linked: "Ora Gioca su Spellbreak in Steam apre Elemental Fracture.",
      unlinked: "Il pulsante Gioca di Spellbreak su Steam è tornato normale.",
      quickstart: "Entra subito nel gioco",
      quickstartHelp: "Premendo Gioca su Spellbreak in Steam il gioco si avvia senza mostrare il launcher, con l'ultima modalità di gioco scelta. Per aprire il launcher (ad esempio per cambiare modalità di gioco), tieni premuto Maiusc mentre premi Gioca finché non compare. Si apre da solo anche quando c'è un aggiornamento da installare o devi accedere.",
      shortcut: "Aggiungi Elemental Fracture a Steam",
      shortcutHelp: "Aggiunge il launcher alla tua libreria di Steam come gioco non di Steam, con le immagini, così puoi assegnargli una configurazione del controller di Steam. Usalo se non possiedi Spellbreak su Steam.",
      added: "Aggiunto alla tua libreria di Steam.",
      removed: "Rimosso dalla tua libreria di Steam.",
    },
    language: {
      title: "Lingua",
      label: "Lingua dell'interfaccia",
      help: "Ha effetto subito. «Sistema» segue il tuo sistema operativo e ripiega sull'inglese quando il launcher non parla quella lingua.",
      system: "Sistema",
    },
    wrapper: {
      title: "Comando di avvio",
      command: "Comando",
      commandHelp: "(esegue l'eseguibile del gioco — consigliato Proton-GE)",
      custom: "Personalizzato…",
      noDxvkTag: "(senza DXVK, sconsigliato)",
      noDxvk:
        "Wine semplice avvia il gioco senza DXVK: i personaggi appaiono bianchi e va lento. Il launcher passa a umu-run (Proton) quando premi Gioca.",
      placeholder: "es. umu-run",
      placeholderNone: "es. umu-run (nessuno rilevato; installa Wine o umu)",
      prefix: "Prefix di Wine",
      prefixHelp:
        "(facoltativo; passato come WINEPREFIX, vuoto = il launcher crea il suo)",
      prefixPlaceholder: "es. /home/tu/.wineprefixes/spellbreak",
      pickPrefix: "Seleziona una cartella di prefix di Wine",
      browse: "Sfoglia…",
    },
    urls: {
      title: "URL",
      cdn: "Base CDN",
      cdnHelp: "(da dove arrivano gli aggiornamenti del gioco e del launcher)",
      auth: "URL di autenticazione",
      authHelp:
        "(endpoint di validazione della sessione; da lì si ricava l'host del server di gioco)",
      players: "URL dei giocatori",
      playersHelp: "(endpoint del servizio giocatori)",
    },
    reset: {
      button: "Reimposta le impostazioni",
      confirm: "Fai clic di nuovo per confermare",
      title:
        "Riporta le impostazioni di questa pagina ai valori predefiniti",
      done: "Impostazioni reimpostate",
    },
  },

  wizard: {
    welcomeTitle: "Benvenuto in Elemental Fracture",
    welcomeSub: "Siamo felici che tu sia qui.",
    next: "Avanti",
    gameTitle: "Hai già installato il gioco?",
    gameSub:
      "Se Spellbreak è già su questo computer, indica al launcher la sua cartella e hai finito.",
    gameNo: "No, non ancora",
    gameYes: "Sì, trova la mia installazione",
    looking: "Ricerca di un'installazione esistente…",
    pickFolder:
      "Seleziona la tua cartella di Spellbreak (contiene g3 ed Engine)",
    noFolder:
      "Nessuna cartella selezionata, puoi indicarla quando vuoi nelle Impostazioni.",
    hooked: "Trovata: {path}, {step}",
    installingMods: "installazione di aggiornamenti e mod…",
    skip: "Salta per ora",
    doneTitle: "È tutto pronto!",
    doneTitleNamed: "È tutto pronto, {name}!",
    doneSub: "Le Hollow Lands ti chiamano ancora, breaker.",
    enter: "Entra nel launcher",
  },

  account: {
    title: "Accedi a Elemental Fracture",
    sub: "Usa l'e-mail e la password di Elemental Fracture — lo stesso account del sito.",
    email: "E-mail",
    password: "Password",
    signIn: "Accedi",
    signingIn: "Accesso…",
    forgot: "Password dimenticata?",
    createOne: "Creane uno",
    needHelp: "Serve aiuto?",
    quickStart: "Guida rapida",
    welcomeBack: "Bentornato, {name}!",
    welcomeBackAs: "Bentornato, {name} ({role})!",
    roleDev: "dev",
    roleStaff: "staff",
    roleTester: "tester",
  },

  footer: {
    connect: "Unisciti",
    connectTitle: "Unisciti su Discord",
    donate: "Dona",
    donateTitle: "Dona su Patreon",
    patchNotes: "Note della patch",
  },

  update: {
    title: "Aggiornamento del launcher disponibile",
    installing: "Installazione…",
    ready: "v{version} pronta · fai clic per aggiornare",
    click: "Fai clic per aggiornare",
    afterGame: "v{version} verrà installata alla chiusura del gioco",
    dismiss: "Ignora",
  },

  topbar: {
    logo: "Elemental Fracture — apri elefrac.com",
    logoTitle: "Apri elefrac.com",
    players: {
      title: "Giocatori online: clicca per il dettaglio",
      label: "giocatore online",
      label_other: "giocatori online",
      inMatch: "In partita",
      inMenus: "Nei menu",
      empty: "Nessun server sta rispondendo.",
      live: "Partita in corso",
      /* A region the sidecar didn't name, and a family no mode maps to. */
      other: "Altro",
      /* Mode, family and build names are the game's own, kept in English
         like the balance names. */
      families: {
        battleRoyale: "Battle Royale",
        dominion: "Dominion",
        clash: "Clash",
        other: "Altro",
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
      group: "Versione del gioco",
      enabling: "Attivazione…",
      enable: "Attiva il Playtest",
      difference: "Qual è la differenza?",
      efHelp:
        "*Elemental Fracture* è l'edizione della community: talenti rivisti, bilanciamento nuovo e aggiornamenti continui.",
      classicHelp:
        "*Classic* è Spellbreak com'era alla chiusura: il bilanciamento originale, conservato intatto.",
      playtestHelp:
        "*Playtest* è il canale di test privato: bilanciamento inedito che i tester provano prima dell'uscita.",
      efTitle: "Bilanciamento Elemental Fracture",
      classicTitle: "Spellbreak Classic",
      playtestTitle: "Build di test privata",
    },
    account: {
      title: "Account",
      guest: "Ospite",
      signIn: "Accedi",
      sessionExpired: "Sessione scaduta",
      signOut: "Esci",
      signedOut: "Disconnesso.",
      closeFriends: "Chiudi la lista amici",
      you: "Tu",
      developer: "Sviluppatore",
      staff: "Staff",
      tester: "Tester",
    },
  },

  friends: {
    add: "Aggiungi",
    addTitle: "Invia richiesta di amicizia",
    addPlaceholder: "Aggiungi tramite Spellbreak ID (nome utente)",
    loading: "Caricamento…",
    none: "Ancora nessun amico, aggiungi qualcuno tramite il suo Spellbreak ID qui sopra.",
    onlineSection: "Amici ({n})",
    onlineEmpty: "Al momento non c'è nessuno online.",
    requestsSection: "Richieste ({n})",
    offlineSection: "Offline ({n})",
    offlineEmpty: "Nessun amico offline.",
    requested: "richiesto",
    inGame: "in partita",
    online: "online",
    offline: "offline",
    remove: "Rimuovi dagli amici",
    accept: "Accetta",
    decline: "Rifiuta",
    cancelRequest: "Annulla la richiesta",
    actionFor: "{action}: {name}",
    confirmTitle: "Rimuovere {name}?",
    confirmBody: "{name} verrà rimosso dalla tua lista amici.",
    confirmCancel: "Annulla",
    confirmRemove: "Rimuovi",
    errors: {
      userNotFound: "Nessun giocatore con quello Spellbreak ID.",
      cannotFriendSelf: "Quello sei tu!",
      sessionExpired: "La tua sessione è scaduta: accedi di nuovo.",
      usernameRequired: "Inserisci uno Spellbreak ID.",
      noPendingRequest: "Nessuna richiesta in sospeso da parte sua.",
      unavailable: "Server degli amici non disponibile, riprova.",
    },
  },

  sidebar: {
    home: "Home",
    mods: "Impostazioni del gioco",
    settings: "Impostazioni del launcher",
    about: "Informazioni",
  },

  home: {
    greeting: {
      fallbackName: "breaker",
      night: "Ancora sveglio a quest'ora, {name}?",
      nightAlt: "Le Hollow Lands non dormono mai, {name}.",
      morning: "Buongiorno, {name}!",
      morningAlt: "In piedi e a lanciare incantesimi, {name}!",
      afternoon: "Buon pomeriggio, {name}!",
      afternoonAlt: "Tempo perfetto per una tempesta magica, {name}.",
      evening: "Buonasera, {name}!",
      eveningAlt: "La tempesta arriva al calar della sera, {name}.",
    },
    hero: {
      efTitle: "Le Hollow Lands ti chiamano ancora, breaker",
      efSub:
        "Server della community, battaglie ripristinate, bilanciamento nuovo. Spellbreak continua a vivere.",
      classicTitle: "Le Hollow Lands, come erano un tempo.",
      classicSub:
        "Server della community, battaglie ripristinate, il bilanciamento originale. Spellbreak, conservato.",
      playtestTitle: "Le Hollow Lands, un passo avanti alla tempesta.",
      playtestSub:
        "Bilanciamento inedito, per i tester. Aspettati qualche spigolo: i tuoi riscontri danno forma a ciò che uscirà.",
    },
    install: {
      noInstall:
        "Nessuna installazione di Spellbreak configurata. Trova un'installazione esistente o scarica il gioco.",
      exeMissing:
        "Spellbreak.exe non è stato trovato nella cartella configurata. Indica la cartella giusta o riscarica il gioco.",
      locate: "Trova un'installazione esistente",
      download: "Scarica il gioco…",
    },
    launch: {
      launch: "Gioca",
      launchTitle: "Avvia Spellbreak",
      updatingTitle: "Aggiornamento del gioco…",
      update: "Aggiorna",
      updating: "Aggiornamento",
      updateTitle: "Scarica l'aggiornamento v{version}",
      updateTitleUnknown: "Scarica l'aggiornamento del gioco",
      downloadingTitle: "Download dell'aggiornamento del gioco…",
      hint: "È uscita la versione {version} — aggiorna per giocare.",
      hintUnknown:
        "È uscito un aggiornamento del gioco — aggiorna per giocare.",
      patchShipped:
        "È uscito un aggiornamento del gioco — aggiorna prima di giocare.",
      launching: "Avvio di Spellbreak…",
    },
    events: {
      title: "Eventi in diretta",
      live: "IN DIRETTA",
      interested: "{count} interessato",
      interested_other: "{count} interessati",
      inMinutes: "{when} (tra {minutes} min)",
      inHours: "{when} (tra {hours} h)",
    },
    news: {
      title: "Novità",
      empty: "Nessuna novità al momento.",
    },
    stages: {
      downloadBase: "Download del gioco",
      extractBase: "Estrazione del gioco",
      verifyBase: "Verifica dei file di gioco",
      downloadPatch: "Download dell'aggiornamento",
      extractPatch: "Installazione dell'aggiornamento",
      installMods: "Installazione delle mod",
      downloadPlaytest: "Download della build di test",
      extractPlaytest: "Installazione della build di test",
      done: "Fatto",
    },
  },

  game: {
    title: "Gioco",
    version: "(v{version})",
    locate: "Trova l'installazione",
    checkUpdates: "Cerca aggiornamenti del gioco",
    checking: "Ricerca…",
    forceUpdate: "Forza l'ultimo aggiornamento",
    forcing: "Aggiornamento…",
    download: "Scarica il gioco…",
    location: "Cartella di installazione",
    locationPlaceholder: "Non impostata",
    browse: "Sfoglia…",
    save: "Salva",
    noFolder:
      "Nessuna cartella del gioco impostata — usa Trova o Scarica il gioco.",
    pickFolder: "Seleziona la tua cartella di Spellbreak",
    pickDestination: "Scegli dove installare Spellbreak (servono circa 25 GB)",
    folderSet: "Cartella del gioco impostata: {path}",
    folderUpdated: "Cartella del gioco aggiornata",
    updateAvailable:
      "Aggiornamento del gioco disponibile (v{version}) — avvialo dalla Home.",
    upToDate: "Il gioco è aggiornato",
    unreachable:
      "Impossibile raggiungere il server degli aggiornamenti, controlla la base CDN nelle Impostazioni.",
    downloading:
      "Installazione in corso: il download è grosso, lascia il launcher aperto.",
    downloaded: "Gioco installato in {path}",
    downloadFailed: "Installazione non riuscita: {detail}",
    alreadyCurrent: "Già aggiornato (v{version})",
    provisioning: "Installazione di aggiornamenti e mod…",
    provisioned: "Installazione pronta (v{version})",
    provisionedUnknown: "Installazione pronta",
    provisionFailed: "Impossibile aggiornare l'installazione: {detail}",
    updated: "Gioco aggiornato alla v{version}",
    updatedUnknown: "Gioco aggiornato",
    updateFailed: "Aggiornamento non riuscito: {detail}",
  },

  mods: {
    title: "Mod",
    verify: "Verifica",
    verifying: "Verifica…",
    update: "Aggiorna il gioco",
    updating: "Aggiornamento…",
    install: "Installa / Aggiorna le mod",
    installing: "Installazione…",
    checkingFiles: "Controllo dei file delle mod…",
    installedBadge: "INSTALLATE",
    missingBadge: "MANCANTI",
    ready: "Le mod sono installate e pronte.",
    absent: "Le mod non sono installate.",
    partial: "Mancano alcuni file delle mod.",
    noFolder:
      "Imposta prima la cartella del gioco — usa Trova o Scarica qui sopra.",
    missingCount:
      "Manca {count} file su {total} — esegui Installa / Aggiorna le mod.",
    missingCount_other:
      "Mancano {count} file su {total} — esegui Installa / Aggiorna le mod.",
    patched: "Aggiornato alla v{version}",
    patchedUnknown: "Patch applicata",
    installDone: "Mod installate",
    installFailed: "Installazione non riuscita",
    repair: "Verifica i file di gioco",
    repairing: "Controllo dei file di gioco…",
    repairChecked: "{count} file di gioco controllati: non manca nulla.",
    repairFixed: "{count} file di gioco ripristinato.",
    repairFixed_other: "{count} file di gioco ripristinati.",
    repairStuck: "Non è stato possibile ripristinare {count} file. Riprova e segnalalo se continua a succedere.",
    repairStuck_other: "Non è stato possibile ripristinare {count} file. Riprova e segnalalo se continua a succedere.",
  },

  errors: {
    noGameFolder: "Imposta prima la cartella del gioco (Impostazioni).",
    notSpellbreakInstall:
      "Quella cartella non sembra un'installazione di Spellbreak (manca g3/Binaries/Win64).",
    paksNotFound: "Cartella Paks non trovata: {path}",
    unknownVariant: "Variante sconosciuta: {variant}",
    variantPakMissing:
      "{pak} non è nella cartella Paks: esegui prima Installa / Aggiorna le mod.",
    playtestPakMissing:
      "{pak} non è installato: attiva prima la build Playtest per scaricarlo.",
    noGameBinary:
      "Nessun binario del gioco trovato in {dir} (cercati: {names})",

    modArchiveTooSmall:
      "Il mod.zip scaricato è sospettosamente piccolo: il CDN potrebbe aver restituito una pagina di errore.",
    launcherArchiveTooSmall:
      "Il launcher scaricato è sospettosamente piccolo: il CDN potrebbe aver restituito una pagina di errore.",
    playtestArchiveEmpty:
      "L'archivio di playtest non conteneva alcun file .pak.",
    runtimeMissingUmu: "umu-run non è stato trovato nell'archivio del runtime.",
    rangeRequestsUnsupported:
      "Il server ha smesso di accettare le richieste per intervalli.",
    downloadStalled:
      "Download bloccato (intervallo {range}, {remaining} rimanenti).",
    launcherUpdateDisabledInDev:
      "L'aggiornamento automatico del launcher è disattivato nelle build di sviluppo (imposta EF_LAUNCHER_UPDATE=1).",
    launcherUpdateWaitsForGame:
      "Il launcher si aggiornerà alla chiusura del gioco.",
    extractionMismatch:
      "{count} file di gioco non corrispondono ancora al download dopo una nuova estrazione: {files}. Qualcosa sta modificando i file mentre vengono scritti — di solito l'antivirus. Aggiungi un'esclusione per la cartella del gioco e reinstalla; il download viene conservato, quindi non verrà riscaricato.",
    notEnoughSpace:
      "Spazio su disco insufficiente in {path}: l'installazione richiede {need} liberi e ce ne sono {free}. Il download e il gioco estratto devono starci insieme finché i file non sono verificati.",
    archiveMissingGameFolder:
      "I file estratti non contengono una cartella g3: struttura dell'archivio inattesa.",
    runtimeArchiveCorrupt: "L'archivio del runtime è corrotto o incompleto.",
    runtimeNeedsPython:
      "Non è stato trovato alcun runtime di gioco e python3 manca (a umu / Proton serve). Installa python3 con il tuo gestore di pacchetti, oppure installa Wine, e riprova.",
    launcherVersionUnreadable:
      "Impossibile leggere la versione del launcher dal CDN.",
    archiveTooLarge:
      "Questo download si decomprime in {size}, oltre il limite di {limit}: è stato rifiutato invece di riempire il disco. Riprova; se continua, segnalalo.",

    archiveListingUnavailable:

      "Non è stato possibile leggere l'elenco dei file del download del gioco da {url}, quindi l'installazione non ha potuto essere confrontata. Di solito è un intoppo di rete o del CDN: riprova tra poco.",


    pakSignatureMissing:


      "Il gioco non può avviarsi: manca {file} in {paks} e un pak firmato non si carica senza quel file. Apri Mods ed esegui «Verifica i file di gioco» per ripristinarlo.",



    manifestSignatureInvalid:
      "Il manifesto di rilascio sul CDN non è firmato da Elemental Fracture. Non è stato installato nulla. Riprova più tardi; se continua, segnalalo.",
    manifestRolledBack:
      "Il CDN offre un elenco di rilascio più vecchio (versione {offered}) di quello già accettato da questo launcher ({seen}). Non è stato installato nulla.",
    manifestMissingFile:
      "Il manifesto di rilascio non ha una voce per {file}, quindi non può essere verificato. Non è stato installato nulla.",
    downloadHashMismatch:
      "{file} non corrisponde al checksum pubblicato ed è stato scartato. Riprova; se continua, segnalalo.",
    manifestUnavailable:
      "Impossibile scaricare il manifesto di rilascio dal CDN: {detail}",

    notSignedIn: "Non hai effettuato l'accesso.",
    playersUrlNotConfigured: "URL dei giocatori non configurato.",
    enterEmailAndPassword: "Inserisci la tua e-mail e la tua password.",
    signInNotConfigured: "L'accesso non è configurato.",
    signInFailed: "Accesso non riuscito. Riprova.",
    wrongCredentials: "E-mail o password errate.",
    emailUnverified:
      "Verifica prima la tua e-mail, il codice è nella tua casella di posta.",
    rateLimited: "Troppi tentativi. Attendi qualche minuto.",
    accountSuspended: "Questo account è stato sospeso.",
    accountSuspendedPermanent:
      "Questo account è stato sospeso definitivamente.",
    accountSuspendedUntil:
      "Questo account è stato sospeso. La sospensione terminerà il {ends}.",
    suspensionReason: "Motivo: {reason}",

    wrapperNotInstalled:
      "«{wrapper}» non è installato. Scegli un altro comando di avvio nelle Impostazioni (ad esempio wine o umu-run).",
    wrapperNotInstalledOnHost:
      "«{wrapper}» non è installato sull'host. Scegli un altro comando di avvio nelle Impostazioni (ad esempio wine o umu-run).",
    foreignWinePrefix:
      "Il prefix in {prefix} è stato creato da un altro Wine, e {wrapper} lo convertirebbe in modo permanente (rischiando di rompere l'applicazione a cui appartiene). Scegli una cartella vuota per avere un prefix nuovo, oppure svuota il campo per usare quello predefinito.",

    steamNotFound: "Steam non è installato su questo computer.",
    steamRunning: "Chiudi prima Steam. Salva le proprie impostazioni all'uscita e annullerebbe la modifica.",
    steamNoUser: "Accedi a Steam almeno una volta su questo computer, poi riprova.",
    spellbreakNotInSteam: "Spellbreak non è installato tramite Steam su questo computer.",

    unsupportedLinkScheme: "Si possono aprire solo link http(s).",

    io: "Errore di file: {detail}",
    network: "Errore di rete: {detail}",
    badArchive: "Archivio non valido: {detail}",
    badArchiveEntry:
      "Una voce dell'archivio ha un nome inutilizzabile: {detail}",
    badJson: "Risposta illeggibile: {detail}",
    downloadFailed: "Download non riuscito ({url}): {detail}",
    modDownloadFailed: "Download della mod non riuscito: {detail}",
    steamConfigUnreadable: "Impossibile leggere il file {file} di Steam, quindi non è stato modificato nulla: {detail}",
    launchFailed: "Avvio non riuscito ({command}): {detail}",
    signInUnreachable:
      "Impossibile raggiungere il servizio di accesso: {detail}",
    noAppDataDir:
      "Nessuna cartella dati dell'applicazione disponibile: {detail}",
    runtimeNotExecutable: "Impossibile rendere eseguibile umu-run: {detail}",
    patchVersionWriteFailed:
      "Patch applicata, ma non è stato possibile scrivere version.txt: {detail}",
    launcherStageFailed:
      "Impossibile mettere da parte il binario in esecuzione: {detail}",
    launcherInstallFailed: "Impossibile installare il nuovo binario: {detail}",
    launcherRestartFailed:
      "Aggiornato, ma il launcher non è riuscito a riavviarsi: {detail}",
    backgroundTaskFailed: "Un'attività in background non è riuscita: {detail}",
    unknown: "Qualcosa è andato storto ({code}).",
  },
};
