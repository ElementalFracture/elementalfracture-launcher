import type { Catalogue } from "../index";

/**
 * Spanish. Typed as `Catalogue`, so leaving a key out — or inventing one —
 * fails the build rather than falling back silently at runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (launcher, Wine, prefix, pak, CDN,
 * umu-run, Proton) are left in English on purpose, since that is what the
 * surrounding tooling and the community's own vocabulary use.
 */
export const es: Catalogue = {
  common: {
    moreInfo: "Más información",
    close: "Cerrar",
    loading: "Cargando",
    closeToast: "Cerrar la notificación",
  },

  settings: {
    launcher: {
      title: "Launcher",
      version: "(v{version})",
      checkUpdates: "Buscar actualizaciones del launcher",
      checking: "Buscando…",
      upToDate: "El launcher está actualizado",
      unreachable:
        "No se pudo contactar con el servidor de actualizaciones, revisa la base CDN en Ajustes.",
      minimizeOnClose: "Minimizar a la barra de tareas al cerrar (X)",
      minimizeOnCloseHelp:
        "Pulsar X oculta el launcher en la barra de tareas en vez de cerrarlo, así sigue funcionando en segundo plano. Ciérralo del todo desde su icono en la bandeja o la barra de tareas.",
      closeOnLaunch: "Cerrar el launcher al iniciar el juego",
      closeOnLaunchHelp:
        "Cierra el launcher automáticamente poco después de iniciar el juego, para liberar memoria mientras juegas.",
    },
    steam: {
      title: "Steam",
      closeSteam: "Cerrar Steam",
      closing: "Pidiendo a Steam que se cierre…",
      closeFirst:
        "Cierra Steam para cambiar esto. Steam guarda sus propios ajustes al salir y desharía el cambio.",
      noUser:
        "Inicia sesión en Steam una vez en este equipo para cambiar esto.",
      link: "Jugar a Spellbreak desde Steam",
      linkHelp:
        "Al pulsar Jugar en Spellbreak en tu biblioteca de Steam se abre este launcher. Steam lo trata como Spellbreak, así que funcionan sus configuraciones de mando, el overlay y el tiempo de juego. Tus archivos de Elemental Fracture se quedan donde están.",
      linkUnavailable:
        "Instala primero Spellbreak en Steam. Steam solo muestra Jugar en los juegos instalados, pero el juego se sigue ejecutando desde tu carpeta de Elemental Fracture.",
      linked: "Ahora Jugar en Spellbreak en Steam abre Elemental Fracture.",
      unlinked:
        "El botón Jugar de Spellbreak en Steam vuelve a ser el de siempre.",
      quickstart: "Entrar directamente al juego",
      quickstartHelp:
        "Al pulsar Jugar en Spellbreak en Steam, el juego se inicia sin mostrar el launcher, con el modo de juego que elegiste por última vez. Para abrir el launcher (por ejemplo, para cambiar de modo de juego), mantén pulsado Mayús al pulsar Jugar hasta que aparezca. También se abre solo si hay una actualización que instalar o tienes que iniciar sesión.",
      shortcut: "Añadir Elemental Fracture a Steam",
      shortcutHelp:
        "Añade el launcher a tu biblioteca de Steam como juego ajeno a Steam, con imágenes, para que puedas asignarle una configuración de mando de Steam. Úsalo si no tienes Spellbreak en Steam.",
      added: "Añadido a tu biblioteca de Steam.",
      removed: "Quitado de tu biblioteca de Steam.",
    },
    language: {
      title: "Idioma",
      label: "Idioma de la interfaz",
      help: "Se aplica al instante. «Sistema» sigue el idioma de tu sistema operativo, y usa inglés cuando el launcher no habla ese idioma.",
      system: "Sistema",
    },
    wrapper: {
      title: "Comando de lanzamiento",
      command: "Comando",
      commandHelp: "(ejecuta el .exe del juego — se recomienda Proton-GE)",
      custom: "Personalizado…",
      placeholder: "p. ej. umu-run",
      placeholderNone:
        "p. ej. umu-run (no se detectó ninguno; instala Wine o umu)",
      prefix: "Prefijo de Wine",
      prefixHelp:
        "(opcional; se pasa como WINEPREFIX, vacío = el launcher crea el suyo)",
      prefixPlaceholder: "p. ej. /home/tu-usuario/.wineprefixes/spellbreak",
      pickPrefix: "Selecciona una carpeta de prefijo de Wine",
      browse: "Examinar…",
    },
    urls: {
      title: "URL",
      cdn: "Base CDN",
      cdnHelp:
        "(de dónde se descargan las actualizaciones del juego y del launcher)",
      auth: "URL de autenticación",
      authHelp:
        "(endpoint de validación de sesión; de él se deduce el host del servidor de juego)",
      players: "URL de jugadores",
      playersHelp: "(endpoint del servicio de jugadores)",
    },
    reset: {
      button: "Restablecer los ajustes",
      confirm: "Haz clic otra vez para confirmar",
      title:
        "Restablecer los ajustes de esta página a sus valores predeterminados",
      done: "Ajustes restablecidos",
    },
  },

  wizard: {
    welcomeTitle: "Te damos la bienvenida a Elemental Fracture",
    welcomeSub: "Nos alegra mucho tenerte aquí.",
    next: "Siguiente",
    gameTitle: "¿Ya habías instalado el juego?",
    gameSub:
      "Si Spellbreak ya está en este equipo, indícale su carpeta al launcher y listo.",
    gameNo: "No, todavía no",
    gameYes: "Sí, localizar mi instalación",
    looking: "Buscando una instalación existente…",
    pickFolder: "Selecciona tu carpeta de Spellbreak (contiene g3 y Engine)",
    noFolder:
      "No se seleccionó ninguna carpeta, puedes indicarla cuando quieras en Ajustes.",
    hooked: "Encontrada: {path}, {step}",
    installingMods: "instalando actualizaciones y mods…",
    skip: "Omitir por ahora",
    doneTitle: "¡Todo listo!",
    doneTitleNamed: "¡Todo listo, {name}!",
    doneSub: "Las Hollow Lands te siguen llamando, breaker.",
    enter: "Entrar en el launcher",
  },

  account: {
    title: "Inicia sesión en Elemental Fracture",
    sub: "Usa tu correo y contraseña de Elemental Fracture — la misma cuenta que en la web.",
    email: "Correo electrónico",
    password: "Contraseña",
    signIn: "Iniciar sesión",
    signingIn: "Iniciando sesión…",
    forgot: "¿Olvidaste la contraseña?",
    createOne: "Crear una",
    needHelp: "¿Necesitas ayuda?",
    quickStart: "Guía de inicio rápido",
    welcomeBack: "¡Bienvenido de nuevo, {name}!",
    welcomeBackAs: "¡Bienvenido de nuevo, {name} ({role})!",
    roleDev: "dev",
    roleStaff: "staff",
    roleTester: "tester",
  },

  footer: {
    connect: "Unirse",
    connectTitle: "Unirse al Discord",
    donate: "Donar",
    donateTitle: "Donar en Patreon",
    patchNotes: "Notas del parche",
  },

  update: {
    title: "Actualización del launcher disponible",
    installing: "Instalando…",
    ready: "v{version} lista · haz clic para actualizar",
    click: "Haz clic para actualizar",
    dismiss: "Descartar",
  },

  topbar: {
    logo: "Elemental Fracture — abrir elefrac.com",
    logoTitle: "Abrir elefrac.com",
    players: {
      title: "Jugadores en línea: haz clic para ver el desglose",
      label: "jugador en línea",
      label_other: "jugadores en línea",
      inMatch: "En partida",
      inMenus: "En los menús",
      empty: "Ningún servidor está informando.",
      live: "Partida en curso",
      /* A region the sidecar didn't name, and a family no mode maps to. */
      other: "Otros",
      /* Mode, family and build names are the game's own, kept in English
         like the balance names. */
      families: {
        battleRoyale: "Battle Royale",
        dominion: "Dominion",
        clash: "Clash",
        other: "Otros",
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
      group: "Versión del juego",
      enabling: "Activando…",
      enable: "Activar Playtest",
      difference: "¿Cuál es la diferencia?",
      efHelp:
        "*Elemental Fracture* es la edición comunitaria: talentos rediseñados, equilibrio renovado y actualizaciones constantes.",
      classicHelp:
        "*Classic* es Spellbreak tal y como quedó al cierre: el equilibrio original, intacto.",
      playtestHelp:
        "*Playtest* es el canal de pruebas privado: equilibrio aún sin publicar para que los testers lo prueben antes de su salida.",
      efTitle: "Equilibrio de Elemental Fracture",
      classicTitle: "Spellbreak Classic",
      playtestTitle: "Versión de pruebas privada",
    },
    account: {
      title: "Cuenta",
      guest: "Invitado",
      signIn: "Iniciar sesión",
      sessionExpired: "Sesión caducada",
      signOut: "Cerrar sesión",
      signedOut: "Sesión cerrada.",
      closeFriends: "Cerrar la lista de amigos",
      you: "Tú",
      developer: "Desarrollador",
      staff: "Staff",
      tester: "Tester",
    },
  },

  friends: {
    add: "Añadir",
    addTitle: "Enviar solicitud de amistad",
    addPlaceholder: "Añadir por Spellbreak ID (nombre de usuario)",
    loading: "Cargando…",
    none: "Aún no tienes amigos, añade a alguien por su Spellbreak ID arriba.",
    onlineSection: "Amigos ({n})",
    onlineEmpty: "Ahora mismo no hay nadie conectado.",
    requestsSection: "Solicitudes ({n})",
    offlineSection: "Desconectados ({n})",
    offlineEmpty: "No hay amigos desconectados.",
    requested: "solicitado",
    inGame: "en partida",
    online: "en línea",
    offline: "desconectado",
    remove: "Eliminar de mis amigos",
    accept: "Aceptar",
    decline: "Rechazar",
    cancelRequest: "Cancelar la solicitud",
    actionFor: "{action}: {name}",
    confirmTitle: "¿Eliminar a {name}?",
    confirmBody: "Se eliminará a {name} de tu lista de amigos.",
    confirmCancel: "Cancelar",
    confirmRemove: "Eliminar",
    errors: {
      userNotFound: "No hay ningún jugador con ese Spellbreak ID.",
      cannotFriendSelf: "¡Ese eres tú!",
      sessionExpired: "Tu sesión ha caducado: inicia sesión de nuevo.",
      usernameRequired: "Escribe un Spellbreak ID.",
      noPendingRequest: "No hay ninguna solicitud pendiente suya.",
      unavailable: "Servidor de amigos no disponible, inténtalo de nuevo.",
    },
  },

  sidebar: {
    home: "Inicio",
    mods: "Ajustes del juego",
    settings: "Ajustes del launcher",
    about: "Acerca de",
  },

  home: {
    greeting: {
      fallbackName: "breaker",
      night: "¿Quemándote las pestañas a estas horas, {name}?",
      nightAlt: "Las Hollow Lands nunca duermen, {name}.",
      morning: "¡Buenos días, {name}!",
      morningAlt: "¡Arriba y a lanzar hechizos, {name}!",
      afternoon: "¡Buenas tardes, {name}!",
      afternoonAlt: "Tiempo perfecto para una tormenta mágica, {name}.",
      evening: "¡Buenas noches, {name}!",
      eveningAlt: "La tormenta llega al anochecer, {name}.",
    },
    hero: {
      efTitle: "Las Hollow Lands te siguen llamando, breaker",
      efSub:
        "Servidores comunitarios, batallas restauradas, nuevo equilibrio. Spellbreak sigue vivo.",
      classicTitle: "Las Hollow Lands, como eran antes.",
      classicSub:
        "Servidores comunitarios, batallas restauradas, el equilibrio original. Spellbreak, tal cual.",
      playtestTitle: "Las Hollow Lands, por delante de la tormenta.",
      playtestSub:
        "Equilibrio aún sin publicar, para testers. Habrá asperezas: tus comentarios dan forma a lo que sale.",
    },
    install: {
      noInstall:
        "No hay ninguna instalación de Spellbreak configurada. Localiza una instalación existente o descarga el juego.",
      exeMissing:
        "No se encontró Spellbreak.exe en la carpeta configurada. Localiza la carpeta correcta o vuelve a descargar el juego.",
      locate: "Localizar una instalación",
      download: "Descargar el juego…",
    },
    launch: {
      launch: "Jugar",
      launchTitle: "Iniciar Spellbreak",
      updatingTitle: "Actualizando el juego…",
      update: "Actualizar",
      updating: "Actualizando",
      updateTitle: "Descargar la actualización v{version}",
      updateTitleUnknown: "Descargar la actualización del juego",
      downloadingTitle: "Descargando la actualización del juego…",
      hint: "Ya está la versión {version} — actualiza para jugar.",
      hintUnknown: "Hay una actualización del juego — actualiza para jugar.",
      patchShipped:
        "Salió una actualización del juego — actualiza antes de jugar.",
      launching: "Iniciando Spellbreak…",
    },
    events: {
      title: "Eventos en directo",
      live: "EN DIRECTO",
      interested: "{count} interesado",
      interested_other: "{count} interesados",
      inMinutes: "{when} (en {minutes} min)",
      inHours: "{when} (en {hours} h)",
    },
    news: {
      title: "Novedades",
      empty: "No hay noticias por ahora.",
    },
    stages: {
      downloadBase: "Descargando el juego",
      extractBase: "Extrayendo el juego",
      downloadPatch: "Descargando la actualización",
      extractPatch: "Instalando la actualización",
      installMods: "Instalando los mods",
      downloadPlaytest: "Descargando la versión de pruebas",
      extractPlaytest: "Instalando la versión de pruebas",
      done: "Listo",
    },
  },

  game: {
    title: "Juego",
    version: "(v{version})",
    locate: "Localizar la instalación",
    checkUpdates: "Buscar actualizaciones del juego",
    checking: "Buscando…",
    forceUpdate: "Forzar la última actualización",
    forcing: "Actualizando…",
    download: "Descargar el juego…",
    location: "Carpeta de instalación",
    locationPlaceholder: "Sin definir",
    browse: "Examinar…",
    save: "Guardar",
    noFolder:
      "No hay carpeta del juego definida — usa Localizar o Descargar el juego.",
    pickFolder: "Selecciona tu carpeta de Spellbreak",
    pickDestination: "Elige dónde instalar Spellbreak (hacen falta unos 25 GB)",
    folderSet: "Carpeta del juego definida: {path}",
    folderUpdated: "Carpeta del juego actualizada",
    updateAvailable:
      "Hay una actualización del juego (v{version}) — lánzala desde Inicio.",
    upToDate: "El juego está actualizado",
    unreachable:
      "No se pudo contactar con el servidor de actualizaciones, revisa la base CDN en Ajustes.",
    downloading:
      "Instalando: es una descarga grande, deja el launcher abierto.",
    downloaded: "Juego instalado en {path}",
    downloadFailed: "Fallo en la instalación: {detail}",
    alreadyCurrent: "Ya está actualizado (v{version})",
    provisioning: "Instalando actualizaciones y mods…",
    provisioned: "Instalación lista (v{version})",
    provisionedUnknown: "Instalación lista",
    provisionFailed: "No se pudo actualizar la instalación: {detail}",
    updated: "Juego actualizado a la v{version}",
    updatedUnknown: "Juego actualizado",
    updateFailed: "Fallo en la actualización: {detail}",
  },

  mods: {
    title: "Mods",
    verify: "Verificar",
    verifying: "Verificando…",
    update: "Actualizar el juego",
    updating: "Actualizando…",
    install: "Instalar / Actualizar los mods",
    installing: "Instalando…",
    checkingFiles: "Comprobando los archivos de mods…",
    installedBadge: "INSTALADOS",
    missingBadge: "FALTAN",
    ready: "Los mods están instalados y listos.",
    absent: "Los mods no están instalados.",
    partial: "Faltan algunos archivos de mods.",
    noFolder:
      "Define primero la carpeta del juego — usa Localizar o Descargar arriba.",
    missingCount:
      "Falta {count} de {total} archivo — ejecuta Instalar / Actualizar los mods.",
    missingCount_other:
      "Faltan {count} de {total} archivos — ejecuta Instalar / Actualizar los mods.",
    patched: "Actualizado a la v{version}",
    patchedUnknown: "Parche aplicado",
    installDone: "Mods instalados",
    installFailed: "Fallo en la instalación",
  },

  errors: {
    noGameFolder: "Define primero la carpeta del juego (Ajustes).",
    notSpellbreakInstall:
      "Esa carpeta no parece una instalación de Spellbreak (falta g3/Binaries/Win64).",
    paksNotFound: "No se encontró la carpeta Paks: {path}",
    unknownVariant: "Variante desconocida: {variant}",
    variantPakMissing:
      "{pak} no está en la carpeta Paks: ejecuta antes Instalar / Actualizar los mods.",
    playtestPakMissing:
      "{pak} no está instalado: activa antes la versión Playtest para descargarlo.",
    noGameBinary:
      "No se encontró ningún binario del juego en {dir} (se buscó: {names})",

    modArchiveTooSmall:
      "El mod.zip descargado es sospechosamente pequeño: puede que el CDN haya devuelto una página de error.",
    launcherArchiveTooSmall:
      "El launcher descargado es sospechosamente pequeño: puede que el CDN haya devuelto una página de error.",
    playtestArchiveEmpty: "El archivo de playtest no contenía ningún .pak.",
    runtimeMissingUmu: "No se encontró umu-run dentro del archivo del runtime.",
    rangeRequestsUnsupported:
      "El servidor dejó de aceptar peticiones por rangos.",
    downloadStalled: "Descarga detenida (rango {range}, quedan {remaining}).",
    launcherUpdateDisabledInDev:
      "La autoactualización del launcher está desactivada en las compilaciones de desarrollo (define EF_LAUNCHER_UPDATE=1).",
    extractionIncomplete:
      "Extracción incompleta: se escribieron {written} de {expected} archivos. Es probable que la descarga esté corrupta — borra la carpeta de instalación y vuelve a descargar.",
    archiveMissingGameFolder:
      "Los archivos extraídos no contienen una carpeta g3: estructura de archivo inesperada.",
    runtimeArchiveCorrupt: "El archivo del runtime está corrupto o incompleto.",
    runtimeNeedsPython:
      "No se encontró ningún runtime del juego y falta python3 (umu / Proton lo necesitan). Instala python3 con tu gestor de paquetes, o instala Wine, y vuelve a intentarlo.",
    launcherVersionUnreadable:
      "No se pudo leer la versión del launcher desde el CDN.",
    archiveTooLarge:
      "Esta descarga se descomprime en {size}, por encima del límite de {limit}: se rechazó en lugar de llenar tu disco. Inténtalo de nuevo; si sigue ocurriendo, repórtalo.",

    manifestSignatureInvalid:
      "El manifiesto de la versión en el CDN no está firmado por Elemental Fracture. No se instaló nada. Inténtalo más tarde; si persiste, repórtalo.",
    manifestRolledBack:
      "El CDN ofrece una lista de versiones más antigua (versión {offered}) que la que este launcher ya aceptó ({seen}). No se instaló nada.",
    manifestMissingFile:
      "El manifiesto de la versión no tiene entrada para {file}, así que no se puede verificar. No se instaló nada.",
    downloadHashMismatch:
      "{file} no coincide con su suma de comprobación publicada y se descartó. Inténtalo de nuevo; si persiste, repórtalo.",
    manifestUnavailable:
      "No se pudo obtener el manifiesto de la versión desde el CDN: {detail}",

    notSignedIn: "No has iniciado sesión.",
    playersUrlNotConfigured: "La URL de jugadores no está configurada.",
    enterEmailAndPassword: "Escribe tu correo y tu contraseña.",
    signInNotConfigured: "El inicio de sesión no está configurado.",
    signInFailed: "Fallo al iniciar sesión. Inténtalo de nuevo.",
    wrongCredentials: "Correo o contraseña incorrectos.",
    emailUnverified:
      "Verifica antes tu correo, busca el código en tu bandeja de entrada.",
    rateLimited: "Demasiados intentos. Espera unos minutos.",
    accountSuspended: "Esta cuenta ha sido suspendida.",
    accountSuspendedPermanent:
      "Esta cuenta ha sido suspendida permanentemente.",
    accountSuspendedUntil:
      "Esta cuenta ha sido suspendida. La suspensión terminará el {ends}.",
    suspensionReason: "Motivo: {reason}",

    wrapperNotInstalled:
      "«{wrapper}» no está instalado. Elige otro comando de lanzamiento en Ajustes (por ejemplo wine o umu-run).",
    wrapperNotInstalledOnHost:
      "«{wrapper}» no está instalado en el host. Elige otro comando de lanzamiento en Ajustes (por ejemplo wine o umu-run).",
    foreignWinePrefix:
      "El prefijo de {prefix} lo creó otro Wine, y {wrapper} lo convertiría de forma permanente (pudiendo romper la aplicación a la que pertenece). Elige una carpeta vacía para tener un prefijo nuevo, o deja el campo vacío para usar el predeterminado.",

    steamNotFound: "Steam no está instalado en este equipo.",
    steamRunning:
      "Cierra Steam primero. Guarda sus propios ajustes al salir y desharía el cambio.",
    steamNoUser:
      "Inicia sesión en Steam una vez en este equipo y vuelve a intentarlo.",
    spellbreakNotInSteam:
      "Spellbreak no está instalado a través de Steam en este equipo.",

    unsupportedLinkScheme: "Solo se pueden abrir enlaces http(s).",

    io: "Error de archivo: {detail}",
    network: "Error de red: {detail}",
    badArchive: "Archivo inválido: {detail}",
    badArchiveEntry:
      "Una entrada del archivo tiene un nombre inutilizable: {detail}",
    badJson: "Respuesta ilegible: {detail}",
    downloadFailed: "Fallo en la descarga ({url}): {detail}",
    modDownloadFailed: "Fallo en la descarga del mod: {detail}",
    steamConfigUnreadable:
      "No se pudo leer el archivo {file} de Steam, así que no se cambió nada: {detail}",
    launchFailed: "Fallo al iniciar ({command}): {detail}",
    signInUnreachable:
      "No se pudo contactar con el servicio de inicio de sesión: {detail}",
    noAppDataDir:
      "No hay ninguna carpeta de datos de la aplicación disponible: {detail}",
    runtimeNotExecutable: "No se pudo hacer ejecutable umu-run: {detail}",
    patchVersionWriteFailed:
      "Se aplicó el parche, pero no se pudo escribir version.txt: {detail}",
    launcherStageFailed: "No se pudo apartar el binario en ejecución: {detail}",
    launcherInstallFailed: "No se pudo instalar el nuevo binario: {detail}",
    launcherRestartFailed:
      "Se actualizó, pero el launcher no pudo reiniciarse: {detail}",
    backgroundTaskFailed: "Falló una tarea en segundo plano: {detail}",
    unknown: "Algo salió mal ({code}).",
  },
};
