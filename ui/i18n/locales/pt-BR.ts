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
      runAsAdmin: "Reiniciar como administrador",
      runAsAdminHelp:
        "Reinicia o launcher, e com ele o jogo, como administrador só nesta sessão. Só é necessário quando não dá para gravar na pasta do Spellbreak de outra forma (por exemplo, dentro de Arquivos de Programas). O Windows pede permissão antes.",
      elevated: "Executando como administrador.",
    },
    steam: {
      title: "Steam",
      closeSteam: "Fechar a Steam",
      closing: "Pedindo para a Steam fechar…",
      closeFirst:
        "Feche a Steam para alterar isto. A Steam salva as próprias configurações ao sair e desfaria a alteração.",
      noUser: "Entre na Steam uma vez neste computador para alterar isto.",
      link: "Jogar Spellbreak pela Steam",
      linkHelp:
        "Clicar em Jogar no Spellbreak da sua biblioteca Steam abre este launcher. A Steam trata como Spellbreak, então as configurações de controle, o overlay e o tempo de jogo funcionam. Seus arquivos do Elemental Fracture continuam onde estão.",
      linkUnavailable:
        "Instale o Spellbreak na Steam primeiro. A Steam só mostra Jogar em jogos instalados, mas o jogo continua rodando da sua pasta do Elemental Fracture.",
      linked: "Agora Jogar no Spellbreak na Steam abre o Elemental Fracture.",
      unlinked: "O botão Jogar do Spellbreak na Steam voltou ao normal.",
      quickstart: "Ir direto para o jogo",
      quickstartHelp:
        "Clicar em Jogar no Spellbreak na Steam inicia o jogo sem mostrar o launcher, usando o último modo de jogo escolhido. Para abrir o launcher (para trocar de modo de jogo, por exemplo), segure Shift ao clicar em Jogar até ele aparecer. Ele também abre sozinho quando há uma atualização para instalar ou você precisa entrar na conta.",
      shortcut: "Adicionar o Elemental Fracture à Steam",
      shortcutHelp:
        "Adiciona o launcher à sua biblioteca Steam como jogo externo, com arte, para você poder definir uma configuração de controle da Steam. Use se você não tem o Spellbreak na Steam.",
      shortcutLinux:
        "No Linux, verifique se Steam está selecionado em Comando de inicialização.",
      added: "Adicionado à sua biblioteca Steam.",
      removed: "Removido da sua biblioteca Steam.",
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
      noDxvkTag: "(sem DXVK, não recomendado)",
      noDxvk:
        "O Wine puro roda o jogo sem DXVK: os personagens ficam brancos e o jogo fica lento. O launcher muda para o umu-run (Proton) ao clicar em Jogar.",
      placeholder: "ex.: umu-run",
      placeholderNone:
        "ex.: umu-run (nenhum detectado; instale o Wine ou o umu)",
      prefix: "Prefixo do Wine",
      prefixHelp:
        "(opcional; passado como WINEPREFIX, vazio = o launcher cria o dele)",
      prefixPlaceholder: "ex.: /home/voce/.wineprefixes/spellbreak",
      pickPrefix: "Selecione uma pasta de prefixo do Wine",
      browse: "Procurar…",
      proton: "Versão do Proton",
      protonHelp:
        "(usada pelo umu-run; Automático prefere o GE-Proton mais recente)",
      protonAuto: "Automático",
      protonMissing: "{path} (não instalado — Automático é usado)",
      steam: "Steam",
      steamId: "ID do jogo na Steam",
      steamIdHelp:
        "(o número depois de steam://rungameid/ no atalho da área de trabalho da Steam do jogo)",
      steamIdPlaceholder: "ex. 18150169937639899136",
      steamIdDetected: "Detectado no atalho da Steam do jogo.",
      steamIdDetectedOther: "O ID de jogo do Elemental Fracture detectado é:",
      steamIdCopy: "Clique para copiar",
      steamIdCopied: "ID do jogo copiado.",
      steamIdCopyFailed: "Não foi possível copiar o ID do jogo.",
      steamProton: "Versão do Proton",
      steamProtonHelp:
        "(configuração de compatibilidade da Steam para o jogo; feche a Steam para alterar)",
      steamProtonDefault: "Padrão da Steam",
      steamProtonSet: "A Steam vai rodar o jogo nesta versão do Proton.",
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
      button: "Redefinir as configurações",
      confirm: "Clique de novo para confirmar",
      title: "Restaurar as configurações desta página para os valores padrão",
      done: "Configurações redefinidas",
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
    afterGame: "v{version} será instalada quando o jogo fechar",
    dismiss: "Dispensar",
  },

  topbar: {
    logo: "Elemental Fracture — abrir elefrac.com",
    logoTitle: "Abrir elefrac.com",
    players: {
      title: "Jogadores online: clique para ver o detalhamento",
      label: "jogador online",
      label_other: "jogadores online",
      inMatch: "Em partida",
      inMenus: "Nos menus",
      empty: "Nenhum servidor está respondendo.",
      live: "Partida em andamento",
      /* A region the sidecar didn't name, and a family no mode maps to. */
      other: "Outros",
      /* Mode, family and build names are the game's own, kept in English
         like the balance names. */
      families: {
        battleRoyale: "Battle Royale",
        dominion: "Dominion",
        clash: "Clash",
        other: "Outros",
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
      verifyBase: "Verificando os arquivos do jogo",
      downloadPatch: "Baixando a atualização",
      extractPatch: "Instalando a atualização",
      installMods: "Instalando os mods",
      downloadPlaytest: "Baixando a build de teste",
      extractPlaytest: "Instalando a build de teste",
      done: "Concluído",
    },
  },

  folder: {
    steamCopy:
      "Essa é a cópia do Spellbreak da Steam. O Elemental Fracture não roda a partir dela: a Steam fica restaurando os próprios arquivos. Use Baixar jogo para instalar a cópia própria do Elemental Fracture.",
    epicCopy:
      "Essa é a cópia do Spellbreak da Epic Games. O Elemental Fracture não roda a partir dela: a Epic fica restaurando os próprios arquivos. Use Baixar jogo para instalar a cópia própria do Elemental Fracture.",
    oneDrive:
      "Essa pasta está dentro do OneDrive. O OneDrive bloqueia e restaura arquivos enquanto sincroniza, então as atualizações não ficam e o jogo continua com arquivos antigos. Mova a pasta do Spellbreak para um lugar como C:\\Games e localize de novo (ou baixe o jogo lá).",
    notWritable:
      "O launcher não consegue gravar em {path}, então atualizações e mods não podem ser instalados ali. Mova a pasta do Spellbreak para um lugar como C:\\Games ou use Reiniciar como administrador nas Configurações.",
    fixed:
      "As permissões da pasta do Spellbreak foram corrigidas, as atualizações já podem ser instaladas.",
    adminTitle: "Permissão necessária",
    adminMessage:
      "O Elemental Fracture não consegue gravar na pasta do Spellbreak em {path}, então atualizações e mods não podem ser instalados. Reiniciar o launcher como administrador só nesta sessão?",
  },
  game: {
    title: "Jogo",
    version: "(v{version})",
    locate: "Localizar instalação",
    checkUpdates: "Procurar atualizações do jogo",
    checking: "Procurando…",
    forceUpdate: "Forçar atualização mais recente",
    forcing: "Atualizando…",
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
    repair: "Verificar arquivos do jogo",
    repairing: "Verificando arquivos do jogo…",
    repairChecked: "{count} arquivos do jogo verificados — nada faltando.",
    repairFixed: "{count} arquivo do jogo restaurado.",
    repairFixed_other: "{count} arquivos do jogo restaurados.",
    repairStuck:
      "Não foi possível restaurar {count} arquivo. Tente de novo e avise se continuar acontecendo.",
    repairStuck_other:
      "Não foi possível restaurar {count} arquivos. Tente de novo e avise se continuar acontecendo.",
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
    launcherUpdateWaitsForGame:
      "O launcher será atualizado quando o jogo fechar.",
    extractionMismatch:
      "{count} arquivo(s) do jogo ainda não batem com o download depois de extraídos de novo: {files}. Algo está alterando os arquivos enquanto são gravados — geralmente o antivírus. Adicione uma exclusão para a pasta do jogo e instale de novo; o download é mantido, então não será baixado outra vez.",
    notEnoughSpace:
      "Espaço em disco insuficiente em {path}: a instalação precisa de {need} livres e há {free}. O download e o jogo extraído precisam caber lado a lado até os arquivos serem verificados.",
    archiveMissingGameFolder:
      "Os arquivos extraídos não têm uma pasta g3: estrutura de arquivo inesperada.",
    runtimeArchiveCorrupt:
      "O arquivo do runtime está corrompido ou incompleto.",
    runtimeNeedsPython:
      "Nenhum runtime do jogo foi encontrado e o python3 está faltando (o umu / Proton precisa dele). Instale o python3 pelo seu gerenciador de pacotes, ou instale o Wine, e tente de novo.",
    launcherVersionUnreadable:
      "Não foi possível ler a versão do launcher no CDN.",
    archiveTooLarge:
      "Este download descompacta para {size}, acima do limite de {limit} — foi recusado em vez de encher seu disco. Tente de novo; se continuar, reporte.",

    archiveListingUnavailable:
      "Não foi possível ler a lista de arquivos do download do jogo em {url}, então a instalação não pôde ser comparada com ela. Normalmente é uma falha de rede ou do CDN — tente de novo em instantes.",

    pakSignatureMissing:
      "O jogo não consegue iniciar: {file} está faltando em {paks}, e um pak assinado não carrega sem esse arquivo. Abra Mods e use “Verificar arquivos do jogo” para restaurá-lo.",

    manifestSignatureInvalid:
      "O manifesto de lançamento no CDN não está assinado pela Elemental Fracture. Nada foi instalado. Tente novamente mais tarde; se continuar, reporte.",
    manifestRolledBack:
      "O CDN está oferecendo uma lista de lançamentos mais antiga (versão {offered}) do que a que este launcher já aceitou ({seen}). Nada foi instalado.",
    manifestMissingFile:
      "O manifesto de lançamento não tem entrada para {file}, então ele não pode ser verificado. Nada foi instalado.",
    downloadHashMismatch:
      "{file} não corresponde à soma de verificação publicada e foi descartado. Tente novamente; se continuar, reporte.",
    manifestUnavailable:
      "Não foi possível obter o manifesto de lançamento no CDN: {detail}",

    notSignedIn: "Você não está conectado.",
    playersUrlNotConfigured: "A URL de jogadores não está configurada.",
    enterEmailAndPassword: "Digite seu e-mail e sua senha.",
    signInNotConfigured: "O login não está configurado.",
    signInFailed: "Falha no login. Tente de novo.",
    wrongCredentials: "E-mail ou senha incorretos.",
    emailUnverified:
      "Verifique seu e-mail primeiro, o código está na sua caixa de entrada.",
    passwordChangeRequired:
      "Você entrou com uma senha temporária. Entre em elefrac.com para escolher sua própria senha e depois entre aqui com ela.",
    tempPasswordExpired:
      "Essa senha temporária expirou. Peça uma nova à equipe ou redefina sua senha em elefrac.com.",
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

    steamNotFound: "A Steam não está instalada neste computador.",
    steamRunning:
      "Feche a Steam primeiro. Ela salva as próprias configurações ao sair e desfaria a alteração.",
    steamNoUser: "Entre na Steam uma vez neste computador e tente de novo.",
    spellbreakNotInSteam:
      "O Spellbreak não está instalado pela Steam neste computador.",

    unsupportedLinkScheme: "Só é possível abrir links http(s).",

    io: "Erro de arquivo: {detail}",
    network: "Erro de rede: {detail}",
    badArchive: "Arquivo inválido: {detail}",
    badArchiveEntry:
      "Uma entrada do arquivo tem um nome inutilizável: {detail}",
    badJson: "Resposta ilegível: {detail}",
    downloadFailed: "Falha no download ({url}): {detail}",
    modDownloadFailed: "Falha no download do mod: {detail}",
    steamConfigUnreadable:
      "Não foi possível ler o arquivo {file} da Steam, então nada foi alterado: {detail}",
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
