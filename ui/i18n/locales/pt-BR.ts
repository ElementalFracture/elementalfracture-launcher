import type { Catalogue } from "../index";

/**
 * Brazilian Portuguese. Typed as `Catalogue`, so leaving a key out — or
 * inventing one — fails the build rather than falling back silently at
 * runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (launcher, Wine, prefix, pak, CDN,
 * umu-run, Proton) are left in English on purpose, since that is what the
 * surrounding tooling and the community's own vocabulary use.
 */
export const ptBR: Catalogue = {
  common: {
    moreInfo: "Mais informações",
    close: "Fechar",
    loading: "Carregando",
    closeToast: "Fechar a notificação",
  },

  settings: {
    launcher: {
      title: "Launcher",
      version: "(v{version})",
      checkUpdates: "Procurar atualizações do launcher",
      checking: "Procurando…",
      upToDate: "O launcher está atualizado",
      unreachable:
        "Não foi possível contatar o servidor de atualizações, confira a base do CDN nas Configurações.",
      minimizeOnClose: "Minimizar para a barra de tarefas ao fechar (X)",
      minimizeOnCloseHelp:
        "Apertar o X esconde o launcher na barra de tarefas em vez de encerrá-lo, então ele continua rodando em segundo plano. Feche-o de vez pelo ícone na bandeja ou na barra de tarefas.",
      closeOnLaunch: "Fechar o launcher quando o jogo iniciar",
      closeOnLaunchHelp:
        "Fecha o launcher automaticamente logo depois que o jogo abre, para liberar memória enquanto você joga.",
    },
    language: {
      title: "Idioma",
      label: "Idioma da interface",
      help: "Vale na hora. «Sistema» segue o seu sistema operacional e volta para o inglês quando o launcher não fala aquele idioma.",
      system: "Sistema",
    },
    wrapper: {
      title: "Comando de inicialização",
      command: "Comando",
      commandHelp: "(executa o .exe do jogo — Proton-GE recomendado)",
      custom: "Personalizado…",
      placeholder: "ex.: umu-run",
      placeholderNone:
        "ex.: umu-run (nenhum detectado; instale o Wine ou o umu)",
      prefix: "Prefixo do Wine",
      prefixHelp:
        "(opcional; passado como WINEPREFIX, vazio = o launcher cria o dele)",
      prefixPlaceholder: "ex.: /home/voce/.wineprefixes/spellbreak",
      pickPrefix: "Selecione uma pasta de prefixo do Wine",
      browse: "Procurar…",
    },
    urls: {
      title: "URLs",
      cdn: "Base do CDN",
      cdnHelp: "(de onde vêm as atualizações do jogo e do launcher)",
      auth: "URL de autenticação",
      authHelp:
        "(endpoint de validação de sessão; o host do servidor de jogo é derivado dele)",
      players: "URL de jogadores",
      playersHelp: "(endpoint do serviço de jogadores)",
    },
    reset: {
      button: "Redefinir a configuração",
      confirm: "Clique de novo para confirmar",
      title:
        "Apagar todas as configurações do launcher e refazer a configuração inicial",
      done: "Configuração redefinida",
    },
  },

  wizard: {
    welcomeTitle: "Boas-vindas ao Elemental Fracture",
    welcomeSub: "Que bom ter você aqui.",
    next: "Avançar",
    gameTitle: "Você já instalou o jogo antes?",
    gameSub:
      "Se o Spellbreak já está nesta máquina, aponte o launcher para a pasta dele e pronto.",
    gameNo: "Não, ainda não",
    gameYes: "Sim, localizar minha instalação",
    looking: "Procurando uma instalação existente…",
    pickFolder: "Selecione sua pasta do Spellbreak (contém g3 e Engine)",
    noFolder:
      "Nenhuma pasta selecionada, você pode definir isso quando quiser nas Configurações.",
    hooked: "Encontrada: {path}, {step}",
    installingMods: "instalando atualizações e mods…",
    skip: "Pular por enquanto",
    doneTitle: "Tudo pronto!",
    doneTitleNamed: "Tudo pronto, {name}!",
    doneSub: "As Hollow Lands ainda chamam por você, breaker.",
    enter: "Entrar no launcher",
  },

  account: {
    title: "Entrar no Elemental Fracture",
    sub: "Use seu e-mail e senha do Elemental Fracture — a mesma conta do site.",
    email: "E-mail",
    password: "Senha",
    signIn: "Entrar",
    signingIn: "Entrando…",
    forgot: "Esqueceu a senha?",
    createOne: "Criar uma",
    needHelp: "Precisa de ajuda?",
    quickStart: "Guia de início rápido",
    welcomeBack: "Que bom te ver de novo, {name}!",
    welcomeBackAs: "Que bom te ver de novo, {name} ({role})!",
    roleDev: "dev",
    roleStaff: "staff",
    roleTester: "tester",
  },

  footer: {
    connect: "Entrar",
    connectTitle: "Entrar no Discord",
    donate: "Doar",
    donateTitle: "Doar no Patreon",
    patchNotes: "Notas do patch",
  },

  update: {
    title: "Atualização do launcher disponível",
    installing: "Instalando…",
    ready: "v{version} pronta · clique para atualizar",
    click: "Clique para atualizar",
    dismiss: "Dispensar",
  },

  topbar: {
    logo: "Elemental Fracture — abrir elefrac.com",
    logoTitle: "Abrir elefrac.com",
    ingame: {
      title: "Jogadores em partida: clique para ver o detalhamento",
      label: "em partida",
      empty: "Ninguém em partida",
      mode: "Modo",
      other: "Outros",
      /* Mode names as the community says them, like the nouns above. */
      modes: {
        solos: "Solos",
        duos: "Duos",
        squads: "Squads",
        arena: "Arena/TDM",
      },
    },
    variant: {
      group: "Versão do jogo",
      enabling: "Ativando…",
      enable: "Ativar o Playtest",
      difference: "Qual é a diferença?",
      efHelp:
        "*Elemental Fracture* é a edição da comunidade: talentos reformulados, balanceamento novo e atualizações constantes.",
      classicHelp:
        "*Classic* é o Spellbreak como ele era no encerramento: o balanceamento original, preservado intacto.",
      playtestHelp:
        "*Playtest* é o canal de testes privado: balanceamento inédito para os testers experimentarem antes do lançamento.",
      efTitle: "Balanceamento do Elemental Fracture",
      classicTitle: "Spellbreak Classic",
      playtestTitle: "Build de teste privada",
    },
    account: {
      title: "Conta",
      guest: "Convidado",
      signIn: "Entrar",
      sessionExpired: "Sessão expirada",
      signOut: "Sair",
      signedOut: "Você saiu.",
      closeFriends: "Fechar a lista de amigos",
      you: "Você",
      developer: "Desenvolvedor",
      staff: "Staff",
      tester: "Tester",
    },
  },

  friends: {
    add: "Adicionar",
    addTitle: "Enviar pedido de amizade",
    addPlaceholder: "Adicionar pelo Spellbreak ID (nome de usuário)",
    loading: "Carregando…",
    none: "Nenhum amigo ainda, adicione alguém pelo Spellbreak ID acima.",
    onlineSection: "Amigos ({n})",
    onlineEmpty: "Ninguém está online agora.",
    requestsSection: "Pedidos ({n})",
    offlineSection: "Offline ({n})",
    offlineEmpty: "Nenhum amigo offline.",
    requested: "pedido enviado",
    inGame: "em partida",
    online: "online",
    offline: "offline",
    remove: "Remover dos amigos",
    accept: "Aceitar",
    decline: "Recusar",
    cancelRequest: "Cancelar o pedido",
    actionFor: "{action}: {name}",
    confirmTitle: "Remover {name}?",
    confirmBody: "{name} será removido da sua lista de amigos.",
    confirmCancel: "Cancelar",
    confirmRemove: "Remover",
    errors: {
      userNotFound: "Nenhum jogador com esse Spellbreak ID.",
      cannotFriendSelf: "Esse é você!",
      sessionExpired: "Sua sessão expirou — entre novamente.",
      usernameRequired: "Digite um Spellbreak ID.",
      noPendingRequest: "Nenhum pedido pendente dessa pessoa.",
      unavailable: "Servidor de amigos indisponível, tente de novo.",
    },
  },

  sidebar: {
    home: "Início",
    mods: "Configurações do jogo",
    settings: "Configurações do launcher",
    about: "Sobre",
  },

  home: {
    greeting: {
      fallbackName: "breaker",
      night: "Virando a noite, {name}?",
      nightAlt: "As Hollow Lands nunca dormem, {name}.",
      morning: "Bom dia, {name}!",
      morningAlt: "De pé e conjurando, {name}!",
      afternoon: "Boa tarde, {name}!",
      afternoonAlt: "Tempo perfeito para uma tempestade mágica, {name}.",
      evening: "Boa noite, {name}!",
      eveningAlt: "A tempestade chega ao anoitecer, {name}.",
    },
    hero: {
      efTitle: "As Hollow Lands ainda chamam por você, breaker",
      efSub:
        "Servidores da comunidade, batalhas restauradas, balanceamento novo. O Spellbreak segue vivo.",
      classicTitle: "As Hollow Lands, como eram antes.",
      classicSub:
        "Servidores da comunidade, batalhas restauradas, o balanceamento original. Spellbreak, preservado.",
      playtestTitle: "As Hollow Lands, à frente da tempestade.",
      playtestSub:
        "Balanceamento inédito, para testers. Espere arestas: o seu retorno molda o que vai ser lançado.",
    },
    install: {
      noInstall:
        "Nenhuma instalação do Spellbreak configurada. Localize uma instalação existente ou baixe o jogo.",
      exeMissing:
        "O Spellbreak.exe não foi encontrado na pasta configurada. Localize a pasta certa ou baixe o jogo de novo.",
      locate: "Localizar instalação existente",
      download: "Baixar o jogo…",
    },
    launch: {
      launch: "Jogar",
      launchTitle: "Iniciar o Spellbreak",
      updatingTitle: "Atualizando o jogo…",
      update: "Atualizar",
      updating: "Atualizando",
      updateTitle: "Baixar a atualização v{version}",
      updateTitleUnknown: "Baixar a atualização do jogo",
      downloadingTitle: "Baixando a atualização do jogo…",
      hint: "A versão {version} saiu — atualize para jogar.",
      hintUnknown: "Saiu uma atualização do jogo — atualize para jogar.",
      patchShipped: "Saiu uma atualização do jogo — atualize antes de jogar.",
      launching: "Iniciando o Spellbreak…",
    },
    events: {
      title: "Eventos ao vivo",
      live: "AO VIVO",
      interested: "{count} interessado",
      interested_other: "{count} interessados",
      inMinutes: "{when} (em {minutes} min)",
      inHours: "{when} (em {hours} h)",
    },
    news: {
      title: "Novidades",
      empty: "Nenhuma notícia por enquanto.",
    },
    stages: {
      downloadBase: "Baixando o jogo",
      extractBase: "Extraindo o jogo",
      downloadPatch: "Baixando a atualização",
      extractPatch: "Instalando a atualização",
      installMods: "Instalando os mods",
      downloadPlaytest: "Baixando a build de teste",
      extractPlaytest: "Instalando a build de teste",
      done: "Concluído",
    },
  },

  game: {
    title: "Jogo",
    version: "(v{version})",
    locate: "Localizar instalação",
    checkUpdates: "Procurar atualizações do jogo",
    checking: "Procurando…",
    download: "Baixar o jogo…",
    location: "Pasta de instalação",
    locationPlaceholder: "Não definida",
    browse: "Procurar…",
    save: "Salvar",
    noFolder:
      "Nenhuma pasta do jogo definida — use Localizar ou Baixar o jogo.",
    pickFolder: "Selecione sua pasta do Spellbreak",
    pickDestination:
      "Escolha onde instalar o Spellbreak (são necessários cerca de 25 GB)",
    folderSet: "Pasta do jogo definida: {path}",
    folderUpdated: "Pasta do jogo atualizada",
    updateAvailable:
      "Atualização do jogo disponível (v{version}) — inicie pela tela de Início.",
    upToDate: "O jogo está atualizado",
    unreachable:
      "Não foi possível contatar o servidor de atualizações, confira a base do CDN nas Configurações.",
    downloading: "Instalando: o download é grande, deixe o launcher aberto.",
    downloaded: "Jogo instalado em {path}",
    downloadFailed: "Falha na instalação: {detail}",
    alreadyCurrent: "Já está atualizado (v{version})",
    provisioning: "Instalando atualizações e mods…",
    provisioned: "Instalação pronta (v{version})",
    provisionedUnknown: "Instalação pronta",
    provisionFailed: "Não foi possível atualizar a instalação: {detail}",
    updated: "Jogo atualizado para a v{version}",
    updatedUnknown: "Jogo atualizado",
    updateFailed: "Falha na atualização: {detail}",
  },

  mods: {
    title: "Mods",
    verify: "Verificar",
    verifying: "Verificando…",
    update: "Atualizar o jogo",
    updating: "Atualizando…",
    install: "Instalar / Atualizar os mods",
    installing: "Instalando…",
    checkingFiles: "Conferindo os arquivos de mods…",
    installedBadge: "INSTALADOS",
    missingBadge: "FALTANDO",
    ready: "Os mods estão instalados e prontos.",
    absent: "Os mods não estão instalados.",
    partial: "Faltam alguns arquivos de mods.",
    noFolder:
      "Defina primeiro a pasta do jogo — use Localizar ou Baixar acima.",
    missingCount:
      "Falta {count} de {total} arquivo — rode Instalar / Atualizar os mods.",
    missingCount_other:
      "Faltam {count} de {total} arquivos — rode Instalar / Atualizar os mods.",
    patched: "Atualizado para a v{version}",
    patchedUnknown: "Patch aplicado",
    installDone: "Mods instalados",
    installFailed: "Falha na instalação",
  },

  errors: {
    noGameFolder: "Defina primeiro a pasta do jogo (Configurações).",
    notSpellbreakInstall:
      "Essa pasta não parece uma instalação do Spellbreak (falta g3/Binaries/Win64).",
    paksNotFound: "Pasta Paks não encontrada: {path}",
    unknownVariant: "Variante desconhecida: {variant}",
    variantPakMissing:
      "{pak} não está na pasta Paks: rode antes Instalar / Atualizar os mods.",
    playtestPakMissing:
      "{pak} não está instalado: ative antes a build Playtest para baixá-lo.",
    noGameBinary:
      "Nenhum binário do jogo encontrado em {dir} (procurou por: {names})",

    modArchiveTooSmall:
      "O mod.zip baixado está pequeno demais: o CDN pode ter devolvido uma página de erro.",
    launcherArchiveTooSmall:
      "O launcher baixado está pequeno demais: o CDN pode ter devolvido uma página de erro.",
    playtestArchiveEmpty: "O arquivo de playtest não continha nenhum .pak.",
    runtimeMissingUmu:
      "O umu-run não foi encontrado dentro do arquivo do runtime.",
    rangeRequestsUnsupported:
      "O servidor parou de aceitar requisições por intervalo.",
    downloadStalled:
      "Download travado (intervalo {range}, faltam {remaining}).",
    launcherUpdateDisabledInDev:
      "A autoatualização do launcher está desligada nas builds de desenvolvimento (defina EF_LAUNCHER_UPDATE=1).",
    extractionIncomplete:
      "Extração incompleta: {written} de {expected} arquivos escritos. O download provavelmente está corrompido — apague a pasta de instalação e baixe de novo.",
    archiveMissingGameFolder:
      "Os arquivos extraídos não têm uma pasta g3: estrutura de arquivo inesperada.",
    runtimeArchiveCorrupt:
      "O arquivo do runtime está corrompido ou incompleto.",
    runtimeNeedsPython:
      "Nenhum runtime do jogo foi encontrado e o python3 está faltando (o umu / Proton precisa dele). Instale o python3 pelo seu gerenciador de pacotes, ou instale o Wine, e tente de novo.",
    launcherVersionUnreadable:
      "Não foi possível ler a versão do launcher no CDN.",

    notSignedIn: "Você não está conectado.",
    playersUrlNotConfigured: "A URL de jogadores não está configurada.",
    enterEmailAndPassword: "Digite seu e-mail e sua senha.",
    signInNotConfigured: "O login não está configurado.",
    signInFailed: "Falha no login. Tente de novo.",
    wrongCredentials: "E-mail ou senha incorretos.",
    emailUnverified:
      "Verifique seu e-mail primeiro, o código está na sua caixa de entrada.",
    rateLimited: "Tentativas demais. Espere alguns minutos.",
    accountSuspended: "Esta conta foi suspensa.",
    accountSuspendedPermanent: "Esta conta foi suspensa permanentemente.",
    accountSuspendedUntil:
      "Esta conta foi suspensa. A suspensão termina em {ends}.",
    suspensionReason: "Motivo: {reason}",

    wrapperNotInstalled:
      "«{wrapper}» não está instalado. Escolha outro comando de inicialização nas Configurações (por exemplo wine ou umu-run).",
    wrapperNotInstalledOnHost:
      "«{wrapper}» não está instalado no host. Escolha outro comando de inicialização nas Configurações (por exemplo wine ou umu-run).",
    foreignWinePrefix:
      "O prefixo em {prefix} foi criado por outro Wine, e o {wrapper} iria convertê-lo permanentemente (podendo quebrar o aplicativo dono dele). Escolha uma pasta vazia para ter um prefixo novo, ou limpe o campo para usar o padrão.",

    unsupportedLinkScheme: "Só é possível abrir links http(s).",

    io: "Erro de arquivo: {detail}",
    network: "Erro de rede: {detail}",
    badArchive: "Arquivo inválido: {detail}",
    badArchiveEntry:
      "Uma entrada do arquivo tem um nome inutilizável: {detail}",
    badJson: "Resposta ilegível: {detail}",
    downloadFailed: "Falha no download ({url}): {detail}",
    modDownloadFailed: "Falha no download do mod: {detail}",
    launchFailed: "Falha ao iniciar ({command}): {detail}",
    signInUnreachable: "Não foi possível contatar o serviço de login: {detail}",
    noAppDataDir: "Nenhuma pasta de dados do aplicativo disponível: {detail}",
    runtimeNotExecutable:
      "Não foi possível tornar o umu-run executável: {detail}",
    patchVersionWriteFailed:
      "O patch foi aplicado, mas o version.txt não pôde ser escrito: {detail}",
    launcherStageFailed:
      "Não foi possível separar o binário em execução: {detail}",
    launcherInstallFailed: "Não foi possível instalar o novo binário: {detail}",
    launcherRestartFailed:
      "Atualizado, mas o launcher não conseguiu reiniciar: {detail}",
    backgroundTaskFailed: "Uma tarefa em segundo plano falhou: {detail}",
    unknown: "Algo deu errado ({code}).",
  },
};
