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
        "(point de validation du token ; l'hôte du serveur de jeu en est déduit)",
      players: "URL des joueurs",
      playersHelp: "(point de terminaison du service de joueurs)",
    },
    reset: {
      button: "Réinitialiser la configuration",
      confirm: "Cliquez à nouveau pour confirmer",
      title:
        "Effacer tous les paramètres du launcher et relancer la configuration initiale",
      done: "Configuration réinitialisée",
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
    noAccountYet: "Vous n'avez pas de compte ?",
    quickStart: "Guide de démarrage",
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
    noAccount: "Pas de compte ?",
    createOne: "Créer un compte",
    cancel: "Annuler",
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
    dismiss: "Ignorer",
  },

  topbar: {
    logo: "Elemental Fracture — Ouvrir elefrac.com",
    logoTitle: "Ouvrir elefrac.com",
    ingame: {
      title: "Joueurs en jeu : cliquez pour afficher le détail",
      label: "en jeu",
      empty: "Personne en jeu",
      mode: "Mode",
      other: "Autre",
      /* Mode names as the community says them, like the nouns above. */
      modes: {
        solos: "Solos",
        duos: "Duos",
        squads: "Squads",
        arena: "Arena/TDM",
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
      invalidToken: "Renseignez d'abord le token de votre compte.",
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
    extractionIncomplete:
      "Extraction incomplète : {written} fichiers écrits sur {expected}. Le téléchargement est probablement corrompu — supprimez le dossier d'installation et retéléchargez.",
    archiveMissingGameFolder:
      "Les fichiers extraits ne contiennent pas de dossier g3 : structure d'archive inattendue.",
    runtimeArchiveCorrupt: "L'archive du runtime est corrompue ou incomplète.",
    runtimeNeedsPython:
      "Aucun runtime de jeu n'a été trouvé et python3 est absent (umu / Proton en a besoin). Installez python3 avec votre gestionnaire de paquets, ou installez Wine, puis réessayez.",
    launcherVersionUnreadable:
      "Impossible de lire la version du launcher depuis le CDN.",

    noAccountToken: "Aucun token de compte défini.",
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

    unsupportedLinkScheme: "Seuls les liens http(s) peuvent être ouverts.",

    io: "Erreur de fichier : {detail}",
    network: "Erreur réseau : {detail}",
    badArchive: "Archive invalide : {detail}",
    badArchiveEntry:
      "Une entrée de l'archive porte un nom inutilisable : {detail}",
    badJson: "Réponse illisible : {detail}",
    downloadFailed: "Échec du téléchargement ({url}) : {detail}",
    modDownloadFailed: "Échec du téléchargement du mod : {detail}",
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
