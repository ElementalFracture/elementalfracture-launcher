import type { Catalogue } from "../index";

/**
 * Simplified Chinese. Typed as `Catalogue`, so leaving a key out — or
 * inventing one — fails the build rather than falling back silently at
 * runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (Wine, prefix, pak, CDN, umu-run,
 * Proton) are left in English on purpose, since that is what the surrounding
 * tooling and the community's own vocabulary use. So are the game's own
 * proper nouns: Spellbreak, Elemental Fracture, the Hollow Lands.
 *
 * Chinese has one plural form, so `Intl.PluralRules` always picks `_other`
 * here — the two forms of a counted string are deliberately identical.
 */
export const zhHans: Catalogue = {
  common: {
    moreInfo: "更多信息",
    close: "关闭",
    loading: "加载中",
    closeToast: "关闭通知",
  },

  settings: {
    launcher: {
      title: "启动器",
      version: "(v{version})",
      checkUpdates: "检查启动器更新",
      checking: "检查中…",
      upToDate: "启动器已是最新版本",
      unreachable: "无法连接更新服务器，请检查设置中的 CDN 地址。",
      minimizeOnClose: "点击 X 时最小化到任务栏",
      minimizeOnCloseHelp:
        "按 X 会把启动器隐藏到任务栏而不是退出，它会继续在后台运行。要彻底退出，请使用托盘或任务栏中的图标。",
      closeOnLaunch: "游戏启动后关闭启动器",
      closeOnLaunchHelp:
        "游戏启动后稍等片刻自动关闭启动器，以便在游戏时释放内存。",
    },
    steam: {
      title: "Steam",
      closeSteam: "关闭 Steam",
      closing: "正在请求 Steam 退出…",
      closeFirst: "请先关闭 Steam 再更改这些设置。Steam 退出时会保存自己的设置，并撤销这里的更改。",
      noUser: "请先在这台电脑上登录一次 Steam，再更改这些设置。",
      link: "从 Steam 启动 Spellbreak",
      linkHelp: "在 Steam 库中点击 Spellbreak 的“开始游戏”会打开本启动器。Steam 会把它当作 Spellbreak，因此手柄布局、游戏内覆盖和游戏时长都能正常使用。你的 Elemental Fracture 文件保持原位。",
      linkUnavailable: "请先在 Steam 中安装 Spellbreak。Steam 只会为已安装的游戏显示“开始游戏”，但游戏仍从你的 Elemental Fracture 文件夹运行。",
      linked: "现在在 Steam 中点击 Spellbreak 的“开始游戏”会打开 Elemental Fracture。",
      unlinked: "Spellbreak 在 Steam 中的“开始游戏”按钮已恢复原样。",
      quickstart: "直接进入游戏",
      quickstartHelp: "在 Steam 中点击 Spellbreak 的“开始游戏”会直接启动游戏，不显示启动器，并使用你上次选择的游戏模式。若想打开启动器（例如切换游戏模式），请在点击“开始游戏”时按住 Shift，直到启动器出现。有更新需要安装或需要登录时，启动器也会自动打开。",
      shortcut: "将 Elemental Fracture 添加到 Steam",
      shortcutHelp: "把启动器作为非 Steam 游戏（带封面图）添加到你的 Steam 库，这样你就能为它设置 Steam 手柄布局。如果你没有在 Steam 上拥有 Spellbreak，请使用此项。",
      added: "已添加到你的 Steam 库。",
      removed: "已从你的 Steam 库移除。",
    },
    language: {
      title: "语言",
      label: "显示语言",
      help: "立即生效。“系统”会跟随你的操作系统语言；启动器不支持该语言时回退到英语。",
      system: "系统",
    },
    wrapper: {
      title: "启动包装器",
      command: "命令",
      commandHelp: "（用于运行游戏 exe — 推荐 Proton-GE）",
      custom: "自定义…",
      noDxvkTag: "（无 DXVK，不推荐）",
      noDxvk:
        "纯 Wine 会在没有 DXVK 的情况下运行游戏：角色显示为白色且运行缓慢。点击“启动”时，启动器会切换到 umu-run（Proton）。",
      placeholder: "例如 umu-run",
      placeholderNone: "例如 umu-run（未检测到；请安装 Wine 或 umu）",
      prefix: "Wine prefix",
      prefixHelp: "（可选；作为 WINEPREFIX 传入，留空则由启动器自行创建）",
      prefixPlaceholder: "例如 /home/you/.wineprefixes/spellbreak",
      pickPrefix: "选择一个 Wine prefix 文件夹",
      browse: "浏览…",
    },
    urls: {
      title: "网址",
      cdn: "CDN 地址",
      cdnHelp: "（游戏和启动器更新的下载来源）",
      auth: "认证地址",
      authHelp: "（会话校验接口；游戏服务器主机由它推导得出）",
      players: "玩家数地址",
      playersHelp: "（玩家数服务接口）",
    },
    reset: {
      button: "重置设置",
      confirm: "再次点击以确认重置",
      title: "将此页面的设置恢复为默认值",
      done: "设置已重置",
    },
  },

  wizard: {
    welcomeTitle: "欢迎来到 Elemental Fracture",
    welcomeSub: "很高兴见到你。",
    next: "下一步",
    gameTitle: "你之前安装过游戏吗？",
    gameSub: "如果这台电脑上已经有 Spellbreak，把它的文件夹指给启动器就好了。",
    gameNo: "还没有",
    gameYes: "有，帮我找到安装位置",
    looking: "正在查找已有的安装…",
    pickFolder: "选择你的 Spellbreak 文件夹（其中包含 g3 和 Engine）",
    noFolder: "未选择文件夹，你随时可以在设置中指定。",
    hooked: "已找到：{path}，{step}",
    installingMods: "正在安装更新和模组…",
    skip: "暂时跳过",
    doneTitle: "一切就绪！",
    doneTitleNamed: "一切就绪，{name}！",
    doneSub: "Hollow Lands 仍在召唤你，breaker。",
    enter: "进入启动器",
  },

  account: {
    title: "登录 Elemental Fracture",
    sub: "使用你的 Elemental Fracture 邮箱和密码 — 与网站上的是同一个账号。",
    email: "邮箱",
    password: "密码",
    signIn: "登录",
    signingIn: "登录中…",
    forgot: "忘记密码？",
    createOne: "注册一个",
    needHelp: "需要帮助？",
    quickStart: "快速上手指南",
    welcomeBack: "欢迎回来，{name}！",
    welcomeBackAs: "欢迎回来，{name}（{role}）！",
    roleDev: "开发者",
    roleStaff: "staff",
    roleTester: "测试员",
  },

  footer: {
    connect: "加入",
    connectTitle: "加入 Discord",
    donate: "捐助",
    donateTitle: "在 Patreon 上捐助",
    patchNotes: "更新日志",
  },

  update: {
    title: "启动器有可用更新",
    installing: "安装中…",
    ready: "v{version} 已就绪 · 点击更新",
    click: "点击更新",
    afterGame: "游戏关闭后将安装 v{version}",
    dismiss: "忽略",
  },

  topbar: {
    logo: "Elemental Fracture — 打开 elefrac.com",
    logoTitle: "打开 elefrac.com",
    players: {
      title: "在线玩家：点击查看详情",
      label: "名玩家在线",
      label_other: "名玩家在线",
      inMatch: "对战中",
      inMenus: "在菜单中",
      empty: "没有服务器在报告。",
      live: "对战进行中",
      /* A region the sidecar didn't name, and a family no mode maps to. */
      other: "其他",
      /* Mode, family and build names are the game's own, kept in English
         like the balance names. */
      families: {
        battleRoyale: "Battle Royale",
        dominion: "Dominion",
        clash: "Clash",
        other: "其他",
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
      group: "游戏版本",
      enabling: "启用中…",
      enable: "启用 Playtest",
      difference: "有什么区别？",
      efHelp:
        "*Elemental Fracture* 是社区版：重做的天赋、全新的平衡性，并持续更新。",
      classicHelp:
        "*Classic* 是关服时的 Spellbreak：原汁原味的平衡性，原样保留。",
      playtestHelp:
        "*Playtest* 是私有测试频道：尚未发布的平衡性改动，供测试员抢先体验。",
      efTitle: "Elemental Fracture 平衡性",
      classicTitle: "经典版 Spellbreak",
      playtestTitle: "私有测试版本",
    },
    account: {
      title: "账号",
      guest: "访客",
      signIn: "登录",
      sessionExpired: "会话已过期",
      signOut: "退出登录",
      signedOut: "已退出登录。",
      closeFriends: "关闭好友列表",
      you: "你",
      developer: "开发者",
      staff: "工作人员",
      tester: "测试员",
    },
  },

  friends: {
    add: "添加",
    addTitle: "发送好友申请",
    addPlaceholder: "通过 Spellbreak ID（用户名）添加",
    loading: "加载中…",
    none: "还没有好友，在上方通过 Spellbreak ID 添加一位吧。",
    onlineSection: "好友（{n}）",
    onlineEmpty: "目前没有人在线。",
    requestsSection: "申请（{n}）",
    offlineSection: "离线（{n}）",
    offlineEmpty: "没有离线好友。",
    requested: "已申请",
    inGame: "游戏中",
    online: "在线",
    offline: "离线",
    remove: "删除好友",
    accept: "接受",
    decline: "拒绝",
    cancelRequest: "取消申请",
    actionFor: "{action}：{name}",
    confirmTitle: "要删除 {name} 吗？",
    confirmBody: "这会把 {name} 从你的好友列表中移除。",
    confirmCancel: "取消",
    confirmRemove: "删除",
    errors: {
      userNotFound: "没有使用该 Spellbreak ID 的玩家。",
      cannotFriendSelf: "那是你自己！",
      sessionExpired: "会话已过期，请重新登录。",
      usernameRequired: "请输入 Spellbreak ID。",
      noPendingRequest: "没有来自对方的待处理申请。",
      unavailable: "好友服务器不可用，请重试。",
    },
  },

  sidebar: {
    home: "主页",
    mods: "游戏设置",
    settings: "启动器设置",
    about: "关于",
  },

  home: {
    greeting: {
      fallbackName: "breaker",
      night: "还在熬夜吗，{name}？",
      nightAlt: "Hollow Lands 从不入眠，{name}。",
      morning: "早上好，{name}！",
      morningAlt: "起床施法吧，{name}！",
      afternoon: "下午好，{name}！",
      afternoonAlt: "正是掀起法术风暴的好天气，{name}。",
      evening: "晚上好，{name}！",
      eveningAlt: "风暴将在暮色中降临，{name}。",
    },
    hero: {
      efTitle: "Hollow Lands 仍在召唤你，breaker",
      efSub: "社区服务器、重启的战斗、全新的平衡性。Spellbreak 仍在延续。",
      classicTitle: "Hollow Lands，一如当年。",
      classicSub: "社区服务器、重启的战斗、原版平衡性。Spellbreak，原样保留。",
      playtestTitle: "Hollow Lands，抢在风暴之前。",
      playtestSub:
        "尚未发布的平衡性改动，供测试员体验。会有粗糙之处：你的反馈决定最终上线的内容。",
    },
    install: {
      noInstall: "尚未配置 Spellbreak 安装位置。请找到已有的安装，或下载游戏。",
      exeMissing:
        "在配置的文件夹中未找到 Spellbreak.exe。请指定正确的文件夹，或重新下载。",
      locate: "查找已有安装",
      download: "下载游戏…",
    },
    launch: {
      launch: "启动",
      launchTitle: "启动 Spellbreak",
      updatingTitle: "正在更新游戏…",
      update: "更新",
      updating: "更新中",
      updateTitle: "下载游戏更新 v{version}",
      updateTitleUnknown: "下载游戏更新",
      downloadingTitle: "正在下载游戏更新…",
      hint: "{version} 版本已发布 — 更新后即可游玩。",
      hintUnknown: "游戏有可用更新 — 更新后即可游玩。",
      patchShipped: "游戏已发布更新 — 请先更新再游玩。",
      launching: "正在启动 Spellbreak…",
    },
    events: {
      title: "近期活动",
      live: "正在进行",
      interested: "{count} 人感兴趣",
      interested_other: "{count} 人感兴趣",
      inMinutes: "{when}（{minutes} 分钟后）",
      inHours: "{when}（{hours} 小时后）",
    },
    news: {
      title: "最新动态",
      empty: "暂时没有新动态。",
    },
    stages: {
      downloadBase: "正在下载游戏",
      extractBase: "正在解压游戏",
      verifyBase: "正在校验游戏文件",
      downloadPatch: "正在下载更新",
      extractPatch: "正在安装更新",
      installMods: "正在安装模组",
      downloadPlaytest: "正在下载测试版本",
      extractPlaytest: "正在安装测试版本",
      done: "完成",
    },
  },

  game: {
    title: "游戏",
    version: "(v{version})",
    locate: "查找安装位置",
    checkUpdates: "检查游戏更新",
    checking: "检查中…",
    forceUpdate: "强制更新到最新版本",
    forcing: "更新中…",
    download: "下载游戏…",
    location: "安装位置",
    locationPlaceholder: "未设置",
    browse: "浏览…",
    save: "保存",
    noFolder: "尚未设置游戏文件夹 — 请使用「查找」或「下载游戏」。",
    pickFolder: "选择你的 Spellbreak 文件夹",
    pickDestination: "选择 Spellbreak 的安装位置（约需 25 GB）",
    folderSet: "游戏文件夹已设置：{path}",
    folderUpdated: "游戏文件夹已更新",
    updateAvailable: "游戏有可用更新（v{version}）— 请在主页启动更新。",
    upToDate: "游戏已是最新版本",
    unreachable: "无法连接更新服务器，请检查设置中的 CDN 地址。",
    downloading: "正在安装：这是一个很大的下载，请保持启动器开着。",
    downloaded: "游戏已安装到 {path}",
    downloadFailed: "安装失败：{detail}",
    alreadyCurrent: "已是最新版本（v{version}）",
    provisioning: "正在安装更新和模组…",
    provisioned: "安装已就绪（v{version}）",
    provisionedUnknown: "安装已就绪",
    provisionFailed: "无法更新该安装：{detail}",
    updated: "游戏已更新到 v{version}",
    updatedUnknown: "游戏已更新",
    updateFailed: "更新失败：{detail}",
  },

  mods: {
    title: "模组",
    verify: "校验",
    verifying: "校验中…",
    update: "更新游戏",
    updating: "更新中…",
    install: "安装 / 更新模组",
    installing: "安装中…",
    checkingFiles: "正在检查模组文件…",
    installedBadge: "已安装",
    missingBadge: "缺失",
    ready: "模组已安装并就绪。",
    absent: "模组尚未安装。",
    partial: "部分模组文件缺失。",
    noFolder: "请先设置游戏文件夹 — 使用上方的「查找」或「下载」。",
    missingCount:
      "{total} 个文件中缺少 {count} 个 — 请运行「安装 / 更新模组」。",
    missingCount_other:
      "{total} 个文件中缺少 {count} 个 — 请运行「安装 / 更新模组」。",
    patched: "已更新到 v{version}",
    patchedUnknown: "补丁已更新",
    installDone: "模组已安装",
    installFailed: "安装失败",
    repair: "校验游戏文件",
    repairing: "正在检查游戏文件…",
    repairChecked: "已检查 {count} 个游戏文件，没有缺失。",
    repairFixed: "已恢复 {count} 个游戏文件。",
    repairFixed_other: "已恢复 {count} 个游戏文件。",
    repairStuck: "有 {count} 个文件无法恢复。请重试；若持续出现，请反馈给我们。",
    repairStuck_other: "有 {count} 个文件无法恢复。请重试；若持续出现，请反馈给我们。",
  },

  errors: {
    noGameFolder: "请先设置游戏文件夹（设置）。",
    notSpellbreakInstall:
      "该文件夹看起来不像 Spellbreak 的安装目录（缺少 g3/Binaries/Win64）。",
    paksNotFound: "未找到 Paks 文件夹：{path}",
    unknownVariant: "未知版本：{variant}",
    variantPakMissing:
      "{pak} 不在 Paks 文件夹中：请先运行「安装 / 更新模组」。",
    playtestPakMissing: "{pak} 尚未安装：请先启用 Playtest 版本以下载它。",
    noGameBinary: "在 {dir} 中未找到游戏可执行文件（查找的是 {names}）",

    modArchiveTooSmall:
      "下载的 mod.zip 小得可疑：CDN 返回的可能是一个错误页面。",
    launcherArchiveTooSmall:
      "下载的启动器小得可疑：CDN 返回的可能是一个错误页面。",
    playtestArchiveEmpty: "测试版压缩包中没有 .pak 文件。",
    runtimeMissingUmu: "运行时压缩包中没有找到 umu-run。",
    rangeRequestsUnsupported: "服务器不再支持分段（range）请求。",
    downloadStalled: "下载已停滞（范围 {range}，还剩 {remaining}）。",
    launcherUpdateDisabledInDev:
      "开发版中已关闭启动器自更新（可设置 EF_LAUNCHER_UPDATE=1）。",
    launcherUpdateWaitsForGame:
      "游戏关闭后启动器将自动更新。",
    extractionMismatch:
      "重新解压后仍有 {count} 个游戏文件与下载内容不一致：{files}。有程序在写入时修改了文件 — 通常是杀毒软件。请将游戏文件夹加入排除列表后重新安装；已下载的文件会保留，不会重复下载。",
    notEnoughSpace:
      "{path} 磁盘空间不足：安装需要 {need} 可用空间，当前只有 {free}。在文件校验完成之前，下载文件和解压后的游戏需要同时存放。",
    archiveMissingGameFolder: "解压出的文件中没有 g3 文件夹：压缩包结构异常。",
    runtimeArchiveCorrupt: "运行时压缩包已损坏或不完整。",
    runtimeNeedsPython:
      "未找到游戏运行时，且缺少 python3（umu / Proton 需要它）。请用你的包管理器安装 python3，或改为安装 Wine，然后重试。",
    launcherVersionUnreadable: "无法从 CDN 读取启动器版本。",
    archiveTooLarge:
      "此下载解压后为 {size}，超过 {limit} 的上限——已拒绝，以免占满磁盘。请重试；如果反复出现，请反馈。",

    archiveListingUnavailable:

      "无法从 {url} 读取游戏下载的文件列表，因此无法据此校验安装。通常是网络或 CDN 的临时问题，请稍后重试。",


    pakSignatureMissing:


      "游戏无法启动：{paks} 中缺少 {file}，已签名的 pak 没有它就无法加载。打开“Mods”并运行“校验游戏文件”即可恢复。",



    manifestSignatureInvalid:
      "CDN 上的发布清单未经 Elemental Fracture 签名。未安装任何内容。请稍后重试；若持续出现，请反馈。",
    manifestRolledBack:
      "CDN 提供的发布清单（版本 {offered}）比此启动器已接受的版本（{seen}）更旧。未安装任何内容。",
    manifestMissingFile:
      "发布清单中没有 {file} 的条目，因此无法校验。未安装任何内容。",
    downloadHashMismatch:
      "{file} 与已发布的校验和不匹配，已丢弃。请重试；若持续出现，请反馈。",
    manifestUnavailable:
      "无法从 CDN 获取发布清单：{detail}",

    notSignedIn: "你尚未登录。",
    playersUrlNotConfigured: "尚未配置玩家数地址。",
    enterEmailAndPassword: "请输入你的邮箱和密码。",
    signInNotConfigured: "尚未配置登录。",
    signInFailed: "登录失败。请重试。",
    wrongCredentials: "邮箱或密码错误。",
    emailUnverified: "请先验证你的邮箱，验证码在你的收件箱里。",
    rateLimited: "尝试次数过多。请等待几分钟。",
    accountSuspended: "该账号已被封禁。",
    accountSuspendedPermanent: "该账号已被永久封禁。",
    accountSuspendedUntil: "该账号已被封禁。封禁将于 {ends} 结束。",
    suspensionReason: "原因：{reason}",

    wrapperNotInstalled:
      "未安装「{wrapper}」。请在设置中换一个启动包装器（例如 wine 或 umu-run）。",
    wrapperNotInstalledOnHost:
      "主机上未安装「{wrapper}」。请在设置中换一个启动包装器（例如 wine 或 umu-run）。",
    foreignWinePrefix:
      "{prefix} 中的 prefix 是由另一个 Wine 创建的，{wrapper} 会将其永久转换（可能破坏拥有它的那个程序）。请选择一个空文件夹以新建 prefix，或清空该字段以使用默认值。",

    steamNotFound: "这台电脑上没有安装 Steam。",
    steamRunning: "请先关闭 Steam。它退出时会保存自己的设置，并撤销这里的更改。",
    steamNoUser: "请先在这台电脑上登录一次 Steam，然后重试。",
    spellbreakNotInSteam: "这台电脑上的 Spellbreak 不是通过 Steam 安装的。",

    unsupportedLinkScheme: "只能打开 http(s) 链接。",

    io: "文件错误：{detail}",
    network: "网络错误：{detail}",
    badArchive: "压缩包无效：{detail}",
    badArchiveEntry: "压缩包中有一项的名称无法使用：{detail}",
    badJson: "无法解析的响应：{detail}",
    downloadFailed: "下载失败（{url}）：{detail}",
    modDownloadFailed: "模组下载失败：{detail}",
    steamConfigUnreadable: "无法读取 Steam 的 {file}，因此未做任何更改：{detail}",
    launchFailed: "启动失败（{command}）：{detail}",
    signInUnreachable: "无法连接登录服务：{detail}",
    noAppDataDir: "没有可用的应用数据目录：{detail}",
    runtimeNotExecutable: "无法为 umu-run 添加可执行权限：{detail}",
    patchVersionWriteFailed: "补丁已应用，但无法写入 version.txt：{detail}",
    launcherStageFailed: "无法暂存正在运行的可执行文件：{detail}",
    launcherInstallFailed: "无法安装新的可执行文件：{detail}",
    launcherRestartFailed: "已更新，但启动器无法重启：{detail}",
    backgroundTaskFailed: "一个后台任务失败了：{detail}",
    unknown: "出了点问题（{code}）。",
  },
};
