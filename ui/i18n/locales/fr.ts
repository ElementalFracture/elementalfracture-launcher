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
  settings: {
    launcher: {
      title: "Lanceur",
      version: "(v{version})",
      checkUpdates: "Rechercher des mises à jour",
      checking: "Recherche…",
      upToDate: "Le lanceur est à jour",
      unreachable:
        "Impossible de joindre le serveur de mise à jour, vérifiez la base CDN dans les Paramètres.",
      minimizeOnClose: "Réduire dans la barre des tâches à la fermeture (X)",
      minimizeOnCloseHelp:
        "Appuyer sur X masque le lanceur dans la barre des tâches au lieu de le quitter : il continue de tourner en arrière-plan. Quittez-le complètement depuis son entrée dans la zone de notification.",
      closeOnLaunch: "Fermer le lanceur au démarrage du jeu",
      closeOnLaunchHelp:
        "Ferme automatiquement le lanceur peu après le démarrage du jeu, pour libérer de la mémoire pendant que vous jouez.",
    },
    language: {
      title: "Langue",
      label: "Langue d'affichage",
      help: "Prend effet immédiatement. Système suit votre système d'exploitation, et revient à l'anglais si le lanceur ne parle pas cette langue.",
      system: "Système",
    },
    wrapper: {
      title: "Commande de lancement",
      command: "Commande",
      commandHelp: "(exécute l'exe du jeu — Proton-GE recommandé)",
      custom: "Personnalisée…",
      placeholder: "ex. umu-run",
      placeholderNone: "ex. umu-run (aucune détectée ; installez Wine ou umu)",
      prefix: "Préfixe Wine",
      prefixHelp:
        "(facultatif ; transmis comme WINEPREFIX, vide = le lanceur crée le sien)",
      prefixPlaceholder: "ex. /home/vous/.wineprefixes/spellbreak",
      pickPrefix: "Sélectionnez un dossier de préfixe Wine",
      browse: "Parcourir…",
    },
    urls: {
      title: "URL",
      cdn: "Base CDN",
      cdnHelp: "(d'où sont téléchargées les mises à jour du jeu et du lanceur)",
      auth: "URL d'authentification",
      authHelp:
        "(point de validation du jeton ; l'hôte du serveur de jeu en est déduit)",
      players: "URL des joueurs",
      playersHelp: "(point de terminaison du service de joueurs)",
    },
    reset: {
      button: "Réinitialiser la configuration",
      confirm: "Cliquez à nouveau pour confirmer",
      title:
        "Effacer tous les paramètres du lanceur et relancer la configuration initiale",
      done: "Configuration réinitialisée",
    },
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
      "Le lanceur téléchargé est anormalement petit : le CDN a peut-être renvoyé une page d'erreur.",
    playtestArchiveEmpty: "L'archive playtest ne contenait aucun fichier .pak.",
    runtimeMissingUmu: "umu-run est introuvable dans l'archive du runtime.",
    rangeRequestsUnsupported:
      "Le serveur a cessé d'accepter les requêtes par plage.",
    downloadStalled:
      "Téléchargement bloqué (plage {range}, {remaining} restants).",
    launcherUpdateDisabledInDev:
      "La mise à jour automatique du lanceur est désactivée dans les versions de développement (définissez EF_LAUNCHER_UPDATE=1).",
    extractionIncomplete:
      "Extraction incomplète : {written} fichiers écrits sur {expected}. Le téléchargement est probablement corrompu — supprimez le dossier d'installation et retéléchargez.",
    archiveMissingGameFolder:
      "Les fichiers extraits ne contiennent pas de dossier g3 : structure d'archive inattendue.",
    runtimeArchiveCorrupt: "L'archive du runtime est corrompue ou incomplète.",
    runtimeNeedsPython:
      "Aucun runtime de jeu n'a été trouvé et python3 est absent (umu / Proton en a besoin). Installez python3 avec votre gestionnaire de paquets, ou installez Wine, puis réessayez.",
    launcherVersionUnreadable:
      "Impossible de lire la version du lanceur depuis le CDN.",

    noAccountToken: "Aucun jeton de compte défini.",
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
      "Mise à jour effectuée, mais le lanceur n'a pas pu redémarrer : {detail}",
    backgroundTaskFailed: "Une tâche en arrière-plan a échoué : {detail}",
    unknown: "Une erreur est survenue ({code}).",
  },
};
