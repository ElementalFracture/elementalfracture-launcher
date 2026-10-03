import type { Catalogue } from "../index";

/**
 * French. Typed as `Catalogue`, so leaving a key out — or inventing one —
 * fails the build rather than falling back silently at runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (Wine, prefix, pak, CDN, umu-run,
 * Proton) are left in English on purpose, since that is what the surrounding
 * tooling and the community's own vocabulary use.
 */
export const fr: Catalogue = {
  common: {
    moreInfo: "Plus d'informations",
    close: "Fermer",
    loading: "Chargement",
    closeToast: "Fermer la notification",
  },

  settings: {
    launcher: {
      title: "Launcher",
      version: "(v{version})",
      checkUpdates: "Rechercher des mises à jour",
      checking: "Recherche…",
      upToDate: "Le launcher est à jour",
      unreachable:
        "Impossible de joindre le serveur de mise à jour, vérifiez la base CDN dans les Paramètres.",
      minimizeOnClose: "Réduire dans la barre des tâches à la fermeture (X)",
      minimizeOnCloseHelp:
        "Appuyer sur X masque le launcher dans la barre des tâches au lieu de le quitter : il continue de tourner en arrière-plan. Quittez-le complètement depuis la barre des tâches.",
      closeOnLaunch: "Fermer le launcher au démarrage du jeu",
      closeOnLaunchHelp:
        "Ferme automatiquement le launcher peu après le démarrage du jeu, pour libérer de la mémoire pendant que vous jouez.",
    },
    steam: {
      title: "Steam",
      closeSteam: "Fermer Steam",
      closing: "Demande de fermeture envoyée à Steam…",
      closeFirst: "Fermez Steam pour modifier ces options. Steam enregistre ses propres paramètres en quittant et annulerait la modification.",
      noUser: "Connectez-vous une fois à Steam sur cet ordinateur pour modifier ces options.",
      link: "Jouer à Spellbreak depuis Steam",
      linkHelp: "Cliquer sur Jouer pour Spellbreak dans votre bibliothèque Steam ouvre ce launcher. Steam le considère comme Spellbreak : les configurations de manette, l'overlay et le temps de jeu fonctionnent. Vos fichiers Elemental Fracture restent où ils sont.",
      linkUnavailable: "Installez d'abord Spellbreak dans Steam. Steam n'affiche Jouer que pour les jeux installés, mais le jeu se lance toujours depuis votre dossier Elemental Fracture.",
      linked: "Jouer sur Spellbreak dans Steam ouvre désormais Elemental Fracture.",
      unlinked: "Le bouton Jouer de Spellbreak dans Steam est revenu à la normale.",
      quickstart: "Lancer directement le jeu",
      quickstartHelp: "Cliquer sur Jouer pour Spellbreak dans Steam lance le jeu sans afficher le launcher, avec le dernier mode de jeu choisi. Pour ouvrir le launcher (pour changer de mode de jeu, par exemple), maintenez Maj en cliquant sur Jouer jusqu'à ce qu'il apparaisse. Il s'ouvre aussi de lui-même quand une mise à jour est à installer ou qu'il faut vous connecter.",
      shortcut: "Ajouter Elemental Fracture à Steam",
      shortcutHelp: "Ajoute le launcher à votre bibliothèque Steam comme jeu non-Steam, avec ses visuels, pour lui attribuer une configuration de manette Steam. À utiliser si vous ne possédez pas Spellbreak sur Steam.",
      added: "Ajouté à votre bibliothèque Steam.",
      removed: "Retiré de votre bibliothèque Steam.",
    },
    language: {
      title: "Langue",
      label: "Langue d'affichage",
      help: "Prend effet immédiatement. 'Système' suit votre système d'exploitation, et revient à l'anglais si le launcher ne parle pas cette langue.",
      system: "Système",
    },
    wrapper: {
      title: "Commande de lancement",
      command: "Commande",
      commandHelp: "(lance l'exécutable du jeu — Proton-GE recommandé)",
      custom: "Personnalisée…",
      placeholder: "ex. umu-run",
      placeholderNone: "ex. umu-run (non détecté ; installez Wine ou umu)",
      prefix: "Préfixe Wine",
      prefixHelp:
        "(facultatif ; transmis comme WINEPREFIX, vide = le launcher crée le sien)",
      prefixPlaceholder: "ex. /home/vous/.wineprefixes/spellbreak",
      pickPrefix: "Sélectionnez un dossier de préfixe Wine",
      browse: "Parcourir…",
    },
    urls: {
      title: "URL",
      cdn: "Base CDN",
      cdnHelp: "(d'où sont téléchargées les mises à jour du jeu et du launcher)",
      auth: "URL d'authentification",
      authHelp:
        "(point de validation de session ; l'hôte du serveur de jeu en est déduit)",
      players: "URL des joueurs",
      playersHelp: "(point de terminaison du service de joueurs)",
    },
    reset: {
      button: "Réinitialiser les paramètres",
      confirm: "Cliquez à nouveau pour confirmer",
      title:
        "Rétablir les paramètres de cette page à leurs valeurs par défaut",
      done: "Paramètres réinitialisés",
    },
  },

  wizard: {
    welcomeTitle: "Bienvenue dans Elemental Fracture",
    welcomeSub: "Nous sommes ravis de vous compter parmi nous !",
    next: "Suivant",
    gameTitle: "Avez-vous déjà installé le jeu ?",
    gameSub:
      "Si Spellbreak est déjà sur cette machine, indiquez son dossier au launcher.",
    gameNo: "Non, pas encore",
    gameYes: "Oui, localiser mon installation",
    looking: "Recherche d'une installation existante…",
    pickFolder: "Sélectionnez votre dossier Spellbreak (contient g3 et Engine)",
    noFolder:
      "Aucun dossier sélectionné, vous pourrez le définir à tout moment dans les Paramètres.",
    hooked: "Trouvé : {path}, {step}",
    installingMods: "installation des mises à jour et des mods…",
    skip: "Passer pour l'instant",
    doneTitle: "Tout est prêt !",
    doneTitleNamed: "Tout est prêt, {name} !",
    doneSub: "Les Hollow Lands vous appellent encore, Breaker.",
    enter: "Entrer dans le launcher",
  },

  account: {
    title: "Se connecter à Elemental Fracture",
    sub: "Utilisez vos e-mail et mot de passe Elemental Fracture — le même compte que sur le site.",
    email: "E-mail",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion…",
    forgot: "Mot de passe oublié ?",
    createOne: "Créer un compte",
    needHelp: "Besoin d'aide ?",
    quickStart: "Guide de démarrage",
    welcomeBack: "Bon retour, {name} !",
    welcomeBackAs: "Bon retour, {name} ({role}) !",
    roleDev: "dev",
    roleStaff: "staff",
    roleTester: "testeur",
  },

  footer: {
    connect: "Rejoindre",
    connectTitle: "Rejoindre le Discord",
    donate: "Soutenir",
    donateTitle: "Soutenir sur Patreon",
    patchNotes: "Notes de version",
  },

  update: {
    title: "Mise à jour du launcher disponible",
    installing: "Installation…",
    ready: "v{version} prête · cliquez pour mettre à jour",
    click: "Cliquez pour mettre à jour",
    afterGame: "v{version} s'installera à la fermeture du jeu",
    dismiss: "Ignorer",
  },

  topbar: {
    logo: "Elemental Fracture — Ouvrir elefrac.com",
    logoTitle: "Ouvrir elefrac.com",
    players: {
      title: "Joueurs en ligne : cliquez pour afficher le détail",
      label: "joueur en ligne",
      label_other: "joueurs en ligne",
      inMatch: "En partie",
      inMenus: "Dans les menus",
      empty: "Aucun serveur ne répond.",
      live: "Partie en cours",
      /* A region the sidecar didn't name, and a family no mode maps to. */
      other: "Autre",
      /* Mode, family and build names are the game's own, kept in English
         like the balance names. */
      families: {
        battleRoyale: "Battle Royale",
        dominion: "Dominion",
        clash: "Clash",
        other: "Autre",
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
      group: "Version du jeu",
      enabling: "Activation…",
      enable: "Activer le Playtest",
      difference: "Quelle différence ?",
      efHelp:
        "*Elemental Fracture* est l'édition communautaire : talents retravaillés, équilibrage revu et mises à jour régulières.",
      classicHelp:
        "*Classic* est Spellbreak tel qu'il était à la fermeture : l'équilibrage d'origine, préservé et intact.",
      playtestHelp:
        "*Playtest* est le canal de playtest privé : un équilibrage inédit que les testeurs essaient avant sa sortie.",
      efTitle: "Équilibrage Elemental Fracture",
      classicTitle: "Spellbreak Classic",
      playtestTitle: "Version playtest privée",
    },
    account: {
      title: "Compte",
      guest: "Invité",
      signIn: "Se connecter",
      sessionExpired: "Session expirée",
      signOut: "Se déconnecter",
      signedOut: "Déconnecté.",
      closeFriends: "Fermer la liste d'amis",
      you: "Vous",
      developer: "Développeur",
      staff: "Staff",
      tester: "Testeur",
    },
  },

  friends: {
    add: "Ajouter",
    addTitle: "Envoyer une demande d'ami",
    addPlaceholder: "Ajouter par Spellbreak ID (nom d'utilisateur)",
    loading: "Chargement…",
    none: "Aucun ami pour l'instant, ajoutez quelqu'un par son Spellbreak ID ci-dessus.",
    onlineSection: "Amis ({n})",
    onlineEmpty: "Personne n'est en ligne pour le moment.",
    requestsSection: "Demandes ({n})",
    offlineSection: "Hors ligne ({n})",
    offlineEmpty: "Aucun ami hors ligne.",
    requested: "demandé",
    inGame: "en jeu",
    online: "en ligne",
    offline: "hors ligne",
    remove: "Retirer de mes amis",
    accept: "Accepter",
    decline: "Refuser",
    cancelRequest: "Annuler la demande",
    actionFor: "{action} : {name}",
    confirmTitle: "Retirer {name} ?",
    confirmBody: "{name} sera retiré de votre liste d'amis.",
    confirmCancel: "Annuler",
    confirmRemove: "Retirer",
    errors: {
      userNotFound: "Aucun joueur avec ce Spellbreak ID.",
      cannotFriendSelf: "C'est vous !",
      sessionExpired: "Votre session a expiré — reconnectez-vous.",
      usernameRequired: "Saisissez un Spellbreak ID.",
      noPendingRequest: "Aucune demande en attente de sa part.",
      unavailable: "Serveur d'amis indisponible, réessayez.",
    },
  },

  sidebar: {
    home: "Accueil",
    mods: "Paramètres du jeu",
    settings: "Paramètres du launcher",
    about: "À propos",
  },

  home: {
    greeting: {
      fallbackName: "Breaker",
      night: "Encore debout à cette heure, {name} ?",
      nightAlt: "Les Hollow Lands ne dorment jamais, {name}.",
      morning: "Bonjour, {name} !",
      morningAlt: "Debout, et à vos sorts, {name} !",
      afternoon: "Bon après-midi, {name} !",
      afternoonAlt: "Un temps parfait pour une tempête magique, {name}.",
      evening: "Bonsoir, {name} !",
      eveningAlt: "La tempête arrive à la tombée de la nuit, {name}.",
    },
    hero: {
      efTitle: "Les Hollow Lands vous appellent encore, Breaker",
      efSub:
        "Serveurs communautaires, batailles restaurées, nouvel équilibrage. Spellbreak continue.",
      classicTitle: "Les Hollow Lands, telles qu'elles étaient.",
      classicSub:
        "Serveurs communautaires, batailles restaurées, équilibrage d'origine. Spellbreak, comme avant.",
      playtestTitle: "Les Hollow Lands, avant la tempête.",
      playtestSub:
        "Équilibrage inédit, pour les testeurs. Attendez-vous à des imperfections : vos retours façonnent ce qui sortira.",
    },
    install: {
      noInstall:
        "Aucune installation de Spellbreak configurée. Localisez une installation existante ou téléchargez le jeu.",
      exeMissing:
        "Spellbreak.exe est introuvable dans le dossier configuré. Localisez le bon dossier ou retéléchargez le jeu.",
      locate: "Localiser une installation",
      download: "Télécharger le jeu…",
    },
    launch: {
      launch: "Lancer",
      launchTitle: "Lancer Spellbreak",
      updatingTitle: "Mise à jour du jeu…",
      update: "Mettre à jour",
      updating: "Mise à jour",
      updateTitle: "Télécharger la mise à jour v{version}",
      updateTitleUnknown: "Télécharger la mise à jour du jeu",
      downloadingTitle: "Téléchargement de la mise à jour…",
      hint: "La version {version} est disponible — mettez à jour pour jouer.",
      hintUnknown:
        "Une mise à jour du jeu est disponible — mettez à jour pour jouer.",
      patchShipped:
        "Une mise à jour est sortie — mettez à jour avant de jouer.",
      launching: "Lancement de Spellbreak…",
    },
    events: {
      title: "Événements en direct",
      live: "EN DIRECT",
      interested: "{count} intéressé",
      interested_other: "{count} intéressés",
      inMinutes: "{when} (dans {minutes} min)",
      inHours: "{when} (dans {hours} h)",
    },
    news: {
      title: "Nouveautés",
      empty: "Aucune actualité pour le moment.",
    },
    stages: {
      downloadBase: "Téléchargement du jeu",
      extractBase: "Extraction du jeu",
      verifyBase: "Vérification des fichiers du jeu",
      downloadPatch: "Téléchargement de la mise à jour",
      extractPatch: "Installation de la mise à jour",
      installMods: "Installation des mods",
      downloadPlaytest: "Téléchargement de la version playtest",
      extractPlaytest: "Installation de la version playtest",
      done: "Terminé",
    },
  },

  game: {
    title: "Jeu",
    version: "(v{version})",
    locate: "Localiser l'installation",
    checkUpdates: "Rechercher des mises à jour du jeu",
    checking: "Recherche…",
    forceUpdate: "Forcer la dernière mise à jour",
    forcing: "Mise à jour…",
    download: "Télécharger le jeu…",
    location: "Dossier d'installation",
    locationPlaceholder: "Non défini",
    browse: "Parcourir…",
    save: "Enregistrer",
    noFolder:
      "Aucun dossier de jeu défini — utilisez Localiser ou Télécharger.",
    pickFolder: "Sélectionnez votre dossier Spellbreak",
    pickDestination:
      "Choisissez où installer Spellbreak (environ 25 Go nécessaires)",
    folderSet: "Dossier du jeu défini : {path}",
    folderUpdated: "Dossier du jeu mis à jour",
    updateAvailable:
      "Mise à jour du jeu disponible (v{version}) — lancez-la depuis l'Accueil.",
    upToDate: "Le jeu est à jour",
    unreachable:
      "Impossible de joindre le serveur de mise à jour, vérifiez la base CDN dans les Paramètres.",
    downloading:
      "Installation en cours : le téléchargement est volumineux, laissez le launcher ouvert.",
    downloaded: "Jeu installé dans {path}",
    downloadFailed: "Échec de l'installation : {detail}",
    alreadyCurrent: "Déjà à jour (v{version})",
    provisioning: "Installation des mises à jour et des mods…",
    provisioned: "Installation prête (v{version})",
    provisionedUnknown: "Installation prête",
    provisionFailed: "Impossible de mettre à jour l'installation : {detail}",
    updated: "Jeu mis à jour en v{version}",
    updatedUnknown: "Jeu mis à jour",
    updateFailed: "Échec de la mise à jour : {detail}",
  },

  mods: {
    title: "Mods",
    verify: "Vérifier",
    verifying: "Vérification…",
    update: "Mettre à jour le jeu",
    updating: "Mise à jour…",
    install: "Installer / Mettre à jour les mods",
    installing: "Installation…",
    checkingFiles: "Vérification des fichiers de mods…",
    installedBadge: "INSTALLÉS",
    missingBadge: "MANQUANTS",
    ready: "Les mods sont installés et prêts.",
    absent: "Les mods ne sont pas installés.",
    partial: "Certains fichiers de mods sont manquants.",
    noFolder:
      "Définissez d'abord le dossier du jeu — utilisez Localiser ou Télécharger ci-dessus.",
    missingCount:
      "{count} fichier manquant sur {total} — lancez Installer / Mettre à jour les mods.",
    missingCount_other:
      "{count} fichiers manquants sur {total} — lancez Installer / Mettre à jour les mods.",
    patched: "Mis à jour en v{version}",
    patchedUnknown: "Correctif appliqué",
    installDone: "Mods installés",
    installFailed: "Échec de l'installation",
    repair: "Vérifier les fichiers du jeu",
    repairing: "Vérification des fichiers du jeu…",
    repairChecked: "{count} fichiers du jeu vérifiés : rien ne manque.",
    repairFixed: "{count} fichier du jeu restauré.",
    repairFixed_other: "{count} fichiers du jeu restaurés.",
    repairStuck: "{count} fichier n'a pas pu être restauré. Réessaie, et signale-le si cela persiste.",
    repairStuck_other: "{count} fichiers n'ont pas pu être restaurés. Réessaie, et signale-le si cela persiste.",
  },

  errors: {
    noGameFolder: "Définissez d'abord le dossier du jeu (Paramètres).",
    notSpellbreakInstall:
      "Ce dossier ne ressemble pas à une installation de Spellbreak (g3/Binaries/Win64 est absent).",
    paksNotFound: "Dossier Paks introuvable : {path}",
    unknownVariant: "Variante inconnue : {variant}",
    variantPakMissing:
      "{pak} n'est pas dans le dossier Paks : lancez d'abord Installer / Mettre à jour les mods.",
    playtestPakMissing:
      "{pak} n'est pas installé : activez d'abord la version Playtest pour le télécharger.",
    noGameBinary:
      "Aucun binaire du jeu trouvé dans {dir} (recherché : {names})",

    modArchiveTooSmall:
      "Le mod.zip téléchargé est anormalement petit : le CDN a peut-être renvoyé une page d'erreur.",
    launcherArchiveTooSmall:
      "Le launcher téléchargé est anormalement petit : le CDN a peut-être renvoyé une page d'erreur.",
    playtestArchiveEmpty: "L'archive playtest ne contenait aucun fichier .pak.",
    runtimeMissingUmu: "umu-run est introuvable dans l'archive du runtime.",
    rangeRequestsUnsupported:
      "Le serveur a cessé d'accepter les requêtes par plage.",
    downloadStalled:
      "Téléchargement bloqué (plage {range}, {remaining} restants).",
    launcherUpdateDisabledInDev:
      "La mise à jour automatique du launcher est désactivée dans les versions de développement (définissez EF_LAUNCHER_UPDATE=1).",
    launcherUpdateWaitsForGame:
      "Le launcher se mettra à jour à la fermeture du jeu.",
    extractionMismatch:
      "{count} fichier(s) du jeu ne correspondent toujours pas au téléchargement après une nouvelle extraction : {files}. Quelque chose modifie les fichiers pendant leur écriture — généralement l'antivirus. Ajoutez une exclusion pour le dossier du jeu, puis relancez l'installation ; le téléchargement est conservé et ne sera pas refait.",
    notEnoughSpace:
      "Espace disque insuffisant sur {path} : l'installation a besoin de {need} libres et il y en a {free}. Le téléchargement et le jeu extrait doivent tenir côte à côte jusqu'à la vérification des fichiers.",
    archiveMissingGameFolder:
      "Les fichiers extraits ne contiennent pas de dossier g3 : structure d'archive inattendue.",
    runtimeArchiveCorrupt: "L'archive du runtime est corrompue ou incomplète.",
    runtimeNeedsPython:
      "Aucun runtime de jeu n'a été trouvé et python3 est absent (umu / Proton en a besoin). Installez python3 avec votre gestionnaire de paquets, ou installez Wine, puis réessayez.",
    launcherVersionUnreadable:
      "Impossible de lire la version du launcher depuis le CDN.",
    archiveTooLarge:
      "Ce téléchargement se décompresse en {size}, au-delà de la limite de {limit} — il a été refusé plutôt que de remplir votre disque. Réessayez ; si cela persiste, signalez-le.",

    archiveListingUnavailable:

      "Impossible de lire la liste des fichiers du téléchargement du jeu depuis {url}, l'installation n'a donc pas pu être comparée. En général un incident réseau ou CDN : réessaie dans un instant.",


    pakSignatureMissing:


      "Le jeu ne peut pas démarrer : {file} est absent de {paks}, et un pak signé ne se charge pas sans ce fichier. Ouvre Mods et lance « Vérifier les fichiers du jeu » pour le restaurer.",



    manifestSignatureInvalid:
      "Le manifeste de version sur le CDN n'est pas signé par Elemental Fracture. Rien n'a été installé. Réessayez plus tard ; si cela persiste, signalez-le.",
    manifestRolledBack:
      "Le CDN propose une liste de versions plus ancienne (version {offered}) que celle déjà acceptée par ce launcher ({seen}). Rien n'a été installé.",
    manifestMissingFile:
      "Le manifeste de version n'a pas d'entrée pour {file}, il est donc impossible de le vérifier. Rien n'a été installé.",
    downloadHashMismatch:
      "{file} ne correspond pas à la somme de contrôle publiée et a été supprimé. Réessayez ; si cela persiste, signalez-le.",
    manifestUnavailable:
      "Impossible de récupérer le manifeste de version depuis le CDN : {detail}",

    notSignedIn: "Vous n'êtes pas connecté.",
    playersUrlNotConfigured: "URL des joueurs non configurée.",
    enterEmailAndPassword: "Saisissez votre e-mail et votre mot de passe.",
    signInNotConfigured: "La connexion n'est pas configurée.",
    signInFailed: "Échec de la connexion. Veuillez réessayer.",
    wrongCredentials: "E-mail ou mot de passe incorrect.",
    emailUnverified:
      "Vérifiez d'abord votre e-mail, le code se trouve dans votre boîte de réception.",
    rateLimited: "Trop de tentatives. Veuillez patienter quelques minutes.",
    accountSuspended: "Ce compte a été suspendu.",
    accountSuspendedPermanent: "Ce compte a été suspendu définitivement.",
    accountSuspendedUntil:
      "Ce compte a été suspendu. La suspension prendra fin le {ends}.",
    suspensionReason: "Motif : {reason}",

    wrapperNotInstalled:
      "« {wrapper} » n'est pas installé. Choisissez une autre commande de lancement dans les Paramètres (par exemple wine ou umu-run).",
    wrapperNotInstalledOnHost:
      "« {wrapper} » n'est pas installé sur l'hôte. Choisissez une autre commande de lancement dans les Paramètres (par exemple wine ou umu-run).",
    foreignWinePrefix:
      "Le préfixe situé dans {prefix} a été créé par un autre Wine, et {wrapper} le convertirait définitivement (au risque de casser l'application à qui il appartient). Choisissez un dossier vide pour obtenir un nouveau préfixe, ou videz le champ pour utiliser celui par défaut.",

    steamNotFound: "Steam n'est pas installé sur cet ordinateur.",
    steamRunning: "Fermez d'abord Steam. Il enregistre ses propres paramètres en quittant et annulerait la modification.",
    steamNoUser: "Connectez-vous une fois à Steam sur cet ordinateur, puis réessayez.",
    spellbreakNotInSteam: "Spellbreak n'est pas installé via Steam sur cet ordinateur.",

    unsupportedLinkScheme: "Seuls les liens http(s) peuvent être ouverts.",

    io: "Erreur de fichier : {detail}",
    network: "Erreur réseau : {detail}",
    badArchive: "Archive invalide : {detail}",
    badArchiveEntry:
      "Une entrée de l'archive porte un nom inutilisable : {detail}",
    badJson: "Réponse illisible : {detail}",
    downloadFailed: "Échec du téléchargement ({url}) : {detail}",
    modDownloadFailed: "Échec du téléchargement du mod : {detail}",
    steamConfigUnreadable: "Impossible de lire le fichier {file} de Steam, rien n'a été modifié : {detail}",
    launchFailed: "Échec du lancement ({command}) : {detail}",
    signInUnreachable:
      "Impossible de joindre le service de connexion : {detail}",
    noAppDataDir:
      "Aucun dossier de données d'application disponible : {detail}",
    runtimeNotExecutable: "Impossible de rendre umu-run exécutable : {detail}",
    patchVersionWriteFailed:
      "Le correctif a été appliqué, mais version.txt n'a pas pu être écrit : {detail}",
    launcherStageFailed:
      "Impossible de mettre de côté le binaire en cours d'exécution : {detail}",
    launcherInstallFailed:
      "Impossible d'installer le nouveau binaire : {detail}",
    launcherRestartFailed:
      "Mise à jour effectuée, mais le launcher n'a pas pu redémarrer : {detail}",
    backgroundTaskFailed: "Une tâche en arrière-plan a échoué : {detail}",
    unknown: "Une erreur est survenue ({code}).",
  },
};
