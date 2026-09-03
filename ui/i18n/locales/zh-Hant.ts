import type { Catalogue } from "../index";

/**
 * Traditional Chinese. Typed as `Catalogue`, so leaving a key out — or
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
export const zhHant: Catalogue = {
  common: {
    moreInfo: "更多資訊",
    close: "關閉",
    loading: "載入中",
    closeToast: "關閉通知",
  },

  settings: {
    launcher: {
      title: "啟動器",
      version: "(v{version})",
      checkUpdates: "檢查啟動器更新",
      checking: "檢查中…",
      upToDate: "啟動器已是最新版本",
      unreachable: "無法連線更新伺服器，請檢查設定中的 CDN 位址。",
      minimizeOnClose: "按下 X 時最小化至工作列",
      minimizeOnCloseHelp:
        "按 X 會把啟動器隱藏到工作列而不是結束，它會繼續在背景執行。要完全結束，請使用系統匣或工作列上的圖示。",
      closeOnLaunch: "遊戲啟動後關閉啟動器",
      closeOnLaunchHelp:
        "遊戲啟動後稍待片刻自動關閉啟動器，讓你遊玩時可以釋放記憶體。",
    },
    language: {
      title: "語言",
      label: "顯示語言",
      help: "立即生效。「系統」會跟隨你的作業系統語言；啟動器不支援該語言時會回到英文。",
      system: "系統",
    },
    wrapper: {
      title: "啟動包裝器",
      command: "指令",
      commandHelp: "（用來執行遊戲 exe — 建議使用 Proton-GE）",
      custom: "自訂…",
      placeholder: "例如 umu-run",
      placeholderNone: "例如 umu-run（未偵測到；請安裝 Wine 或 umu）",
      prefix: "Wine prefix",
      prefixHelp: "（選填；以 WINEPREFIX 傳入，留空則由啟動器自行建立）",
      prefixPlaceholder: "例如 /home/you/.wineprefixes/spellbreak",
      pickPrefix: "選擇一個 Wine prefix 資料夾",
      browse: "瀏覽…",
    },
    urls: {
      title: "網址",
      cdn: "CDN 位址",
      cdnHelp: "（遊戲與啟動器更新的下載來源）",
      auth: "驗證網址",
      authHelp: "（權杖驗證端點；遊戲伺服器主機由它推導而來）",
      players: "玩家數網址",
      playersHelp: "（玩家數服務端點）",
    },
    reset: {
      button: "重設設定",
      confirm: "再按一次以確認重設",
      title: "清除所有啟動器設定並重新進行初次設定",
      done: "設定已重設",
    },
  },

  wizard: {
    welcomeTitle: "歡迎來到 Elemental Fracture",
    welcomeSub: "很高興見到你。",
    next: "下一步",
    gameTitle: "你之前安裝過遊戲嗎？",
    gameSub: "如果這台電腦上已經有 Spellbreak，把它的資料夾指給啟動器就好。",
    gameNo: "還沒有",
    gameYes: "有，幫我找出安裝位置",
    looking: "正在尋找既有的安裝…",
    pickFolder: "選擇你的 Spellbreak 資料夾（其中包含 g3 與 Engine）",
    noFolder: "未選擇資料夾，你隨時可以在設定中指定。",
    hooked: "已找到：{path}，{step}",
    installingMods: "正在安裝更新與模組…",
    noAccountYet: "還沒有帳號？",
    quickStart: "快速上手指南",
    skip: "暫時略過",
    doneTitle: "一切就緒！",
    doneTitleNamed: "一切就緒，{name}！",
    doneSub: "Hollow Lands 仍在呼喚你，breaker。",
    enter: "進入啟動器",
  },

  account: {
    title: "登入 Elemental Fracture",
    sub: "使用你的 Elemental Fracture 電子郵件與密碼 — 和網站上是同一個帳號。",
    email: "電子郵件",
    password: "密碼",
    signIn: "登入",
    signingIn: "登入中…",
    forgot: "忘記密碼？",
    noAccount: "還沒有帳號？",
    createOne: "註冊一個",
    cancel: "取消",
    welcomeBack: "歡迎回來，{name}！",
    welcomeBackAs: "歡迎回來，{name}（{role}）！",
    roleDev: "開發者",
    roleStaff: "staff",
    roleTester: "測試員",
  },

  footer: {
    connect: "加入",
    connectTitle: "加入 Discord",
    donate: "贊助",
    donateTitle: "在 Patreon 上贊助",
    patchNotes: "更新說明",
  },

  update: {
    title: "啟動器有可用更新",
    installing: "安裝中…",
    ready: "v{version} 已就緒 · 點擊更新",
    click: "點擊更新",
    dismiss: "略過",
  },

  topbar: {
    logo: "Elemental Fracture — 開啟 elefrac.com",
    logoTitle: "開啟 elefrac.com",
    ingame: {
      title: "遊戲中的玩家：點擊查看明細",
      label: "遊戲中",
      empty: "目前沒有人在遊戲中",
      mode: "模式",
      other: "其他",
      /* Mode names as the community says them, like the nouns above. */
      modes: {
        solos: "Solos",
        duos: "Duos",
        squads: "Squads",
        arena: "Arena/TDM",
      },
    },
    variant: {
      group: "遊戲版本",
      enabling: "啟用中…",
      enable: "啟用 Playtest",
      difference: "有什麼差別？",
      efHelp:
        "*Elemental Fracture* 是社群版：重製的天賦、全新的平衡性，並持續更新。",
      classicHelp:
        "*Classic* 是關服當時的 Spellbreak：原本的平衡性，原封不動保留下來。",
      playtestHelp:
        "*Playtest* 是私人測試頻道：尚未發布的平衡性調整，讓測試員搶先體驗。",
      efTitle: "Elemental Fracture 平衡性",
      classicTitle: "經典版 Spellbreak",
      playtestTitle: "私人測試版本",
    },
    account: {
      title: "帳號",
      guest: "訪客",
      signIn: "登入",
      sessionExpired: "工作階段已過期",
      signOut: "登出",
      signedOut: "已登出。",
      closeFriends: "關閉好友列表",
      you: "你",
      developer: "開發者",
      staff: "工作人員",
      tester: "測試員",
    },
  },

  friends: {
    add: "新增",
    addTitle: "傳送好友邀請",
    addPlaceholder: "以 Spellbreak ID（使用者名稱）新增",
    loading: "載入中…",
    none: "還沒有好友，在上方以 Spellbreak ID 新增一位吧。",
    onlineSection: "好友（{n}）",
    onlineEmpty: "目前沒有人在線上。",
    requestsSection: "邀請（{n}）",
    offlineSection: "離線（{n}）",
    offlineEmpty: "沒有離線的好友。",
    requested: "已邀請",
    inGame: "遊戲中",
    online: "線上",
    offline: "離線",
    remove: "移除好友",
    accept: "接受",
    decline: "拒絕",
    cancelRequest: "取消邀請",
    actionFor: "{action}：{name}",
    confirmTitle: "要移除 {name} 嗎？",
    confirmBody: "這會將 {name} 從你的好友列表中移除。",
    confirmCancel: "取消",
    confirmRemove: "移除",
    errors: {
      userNotFound: "找不到使用該 Spellbreak ID 的玩家。",
      cannotFriendSelf: "那是你自己！",
      invalidToken: "請先設定你的帳號權杖。",
      usernameRequired: "請輸入 Spellbreak ID。",
      noPendingRequest: "沒有來自對方的待處理邀請。",
      unavailable: "好友伺服器無法使用，請再試一次。",
    },
  },

  sidebar: {
    home: "首頁",
    mods: "遊戲設定",
    settings: "啟動器設定",
    about: "關於",
  },

  home: {
    greeting: {
      fallbackName: "breaker",
      night: "還在熬夜嗎，{name}？",
      nightAlt: "Hollow Lands 從不入眠，{name}。",
      morning: "早安，{name}！",
      morningAlt: "起床施法吧，{name}！",
      afternoon: "午安，{name}！",
      afternoonAlt: "正是掀起法術風暴的好天氣，{name}。",
      evening: "晚安，{name}！",
      eveningAlt: "風暴將在暮色中降臨，{name}。",
    },
    hero: {
      efTitle: "Hollow Lands 仍在呼喚你，breaker",
      efSub: "社群伺服器、重啟的戰鬥、全新的平衡性。Spellbreak 仍在延續。",
      classicTitle: "Hollow Lands，一如當年。",
      classicSub: "社群伺服器、重啟的戰鬥、原版平衡性。Spellbreak，原樣保留。",
      playtestTitle: "Hollow Lands，搶在風暴之前。",
      playtestSub:
        "尚未發布的平衡性調整，供測試員體驗。會有粗糙之處：你的回饋決定最終上線的內容。",
    },
    install: {
      noInstall: "尚未設定 Spellbreak 安裝位置。請找出既有的安裝，或下載遊戲。",
      exeMissing:
        "在設定的資料夾中找不到 Spellbreak.exe。請指定正確的資料夾，或重新下載。",
      locate: "尋找既有安裝",
      download: "下載遊戲…",
    },
    launch: {
      launch: "啟動",
      launchTitle: "啟動 Spellbreak",
      updatingTitle: "正在更新遊戲…",
      update: "更新",
      updating: "更新中",
      updateTitle: "下載遊戲更新 v{version}",
      updateTitleUnknown: "下載遊戲更新",
      downloadingTitle: "正在下載遊戲更新…",
      hint: "{version} 版本已發布 — 更新後即可遊玩。",
      hintUnknown: "遊戲有可用更新 — 更新後即可遊玩。",
      patchShipped: "遊戲已發布更新 — 請先更新再遊玩。",
      launching: "正在啟動 Spellbreak…",
    },
    events: {
      title: "近期活動",
      live: "進行中",
      interested: "{count} 人有興趣",
      interested_other: "{count} 人有興趣",
      inMinutes: "{when}（{minutes} 分鐘後）",
      inHours: "{when}（{hours} 小時後）",
    },
    news: {
      title: "最新消息",
      empty: "目前沒有新消息。",
    },
    stages: {
      downloadBase: "正在下載遊戲",
      extractBase: "正在解壓縮遊戲",
      downloadPatch: "正在下載更新",
      extractPatch: "正在安裝更新",
      installMods: "正在安裝模組",
      downloadPlaytest: "正在下載測試版本",
      extractPlaytest: "正在安裝測試版本",
      done: "完成",
    },
  },

  game: {
    title: "遊戲",
    version: "(v{version})",
    locate: "尋找安裝位置",
    checkUpdates: "檢查遊戲更新",
    checking: "檢查中…",
    download: "下載遊戲…",
    location: "安裝位置",
    locationPlaceholder: "未設定",
    browse: "瀏覽…",
    save: "儲存",
    noFolder: "尚未設定遊戲資料夾 — 請使用「尋找」或「下載遊戲」。",
    pickFolder: "選擇你的 Spellbreak 資料夾",
    pickDestination: "選擇 Spellbreak 的安裝位置（約需 25 GB）",
    folderSet: "遊戲資料夾已設定：{path}",
    folderUpdated: "遊戲資料夾已更新",
    updateAvailable: "遊戲有可用更新（v{version}）— 請在首頁啟動更新。",
    upToDate: "遊戲已是最新版本",
    unreachable: "無法連線更新伺服器，請檢查設定中的 CDN 位址。",
    downloading: "正在安裝：這是很大的下載，請讓啟動器保持開啟。",
    downloaded: "遊戲已安裝到 {path}",
    downloadFailed: "安裝失敗：{detail}",
    alreadyCurrent: "已是最新版本（v{version}）",
    provisioning: "正在安裝更新與模組…",
    provisioned: "安裝已就緒（v{version}）",
    provisionedUnknown: "安裝已就緒",
    provisionFailed: "無法更新此安裝：{detail}",
    updated: "遊戲已更新至 v{version}",
    updatedUnknown: "遊戲已更新",
    updateFailed: "更新失敗：{detail}",
  },

  mods: {
    title: "模組",
    verify: "驗證",
    verifying: "驗證中…",
    update: "更新遊戲",
    updating: "更新中…",
    install: "安裝 / 更新模組",
    installing: "安裝中…",
    checkingFiles: "正在檢查模組檔案…",
    installedBadge: "已安裝",
    missingBadge: "缺少",
    ready: "模組已安裝並就緒。",
    absent: "尚未安裝模組。",
    partial: "部分模組檔案缺少。",
    noFolder: "請先設定遊戲資料夾 — 使用上方的「尋找」或「下載」。",
    missingCount:
      "{total} 個檔案中缺少 {count} 個 — 請執行「安裝 / 更新模組」。",
    missingCount_other:
      "{total} 個檔案中缺少 {count} 個 — 請執行「安裝 / 更新模組」。",
    patched: "已更新至 v{version}",
    patchedUnknown: "修補已更新",
    installDone: "模組已安裝",
    installFailed: "安裝失敗",
  },

  errors: {
    noGameFolder: "請先設定遊戲資料夾（設定）。",
    notSpellbreakInstall:
      "這個資料夾看起來不像 Spellbreak 的安裝目錄（缺少 g3/Binaries/Win64）。",
    paksNotFound: "找不到 Paks 資料夾：{path}",
    unknownVariant: "未知版本：{variant}",
    variantPakMissing:
      "{pak} 不在 Paks 資料夾中：請先執行「安裝 / 更新模組」。",
    playtestPakMissing: "{pak} 尚未安裝：請先啟用 Playtest 版本以下載它。",
    noGameBinary: "在 {dir} 中找不到遊戲執行檔（尋找的是 {names}）",

    modArchiveTooSmall:
      "下載的 mod.zip 小得可疑：CDN 回傳的可能是一個錯誤頁面。",
    launcherArchiveTooSmall:
      "下載的啟動器小得可疑：CDN 回傳的可能是一個錯誤頁面。",
    playtestArchiveEmpty: "測試版壓縮檔中沒有 .pak 檔案。",
    runtimeMissingUmu: "執行環境壓縮檔中找不到 umu-run。",
    rangeRequestsUnsupported: "伺服器不再接受分段（range）請求。",
    downloadStalled: "下載停滯（範圍 {range}，還剩 {remaining}）。",
    launcherUpdateDisabledInDev:
      "開發版本中已關閉啟動器自動更新（可設定 EF_LAUNCHER_UPDATE=1）。",
    extractionIncomplete:
      "解壓縮不完整：{expected} 個檔案中只寫入了 {written} 個。下載很可能已損毀 — 請刪除安裝資料夾並重新下載。",
    archiveMissingGameFolder:
      "解壓縮出的檔案中沒有 g3 資料夾：壓縮檔結構不如預期。",
    runtimeArchiveCorrupt: "執行環境壓縮檔已損毀或不完整。",
    runtimeNeedsPython:
      "找不到遊戲執行環境，且缺少 python3（umu / Proton 需要它）。請用你的套件管理器安裝 python3，或改為安裝 Wine，然後再試一次。",
    launcherVersionUnreadable: "無法從 CDN 讀取啟動器版本。",

    noAccountToken: "尚未設定帳號權杖。",
    playersUrlNotConfigured: "尚未設定玩家數網址。",
    enterEmailAndPassword: "請輸入你的電子郵件與密碼。",
    signInNotConfigured: "尚未設定登入。",
    signInFailed: "登入失敗。請再試一次。",
    wrongCredentials: "電子郵件或密碼錯誤。",
    emailUnverified: "請先驗證你的電子郵件，驗證碼在你的收件匣裡。",
    rateLimited: "嘗試次數過多。請稍候幾分鐘。",
    accountSuspended: "此帳號已被停權。",
    accountSuspendedPermanent: "此帳號已被永久停權。",
    accountSuspendedUntil: "此帳號已被停權。停權將於 {ends} 結束。",
    suspensionReason: "原因：{reason}",

    wrapperNotInstalled:
      "尚未安裝「{wrapper}」。請在設定中改用其他啟動包裝器（例如 wine 或 umu-run）。",
    wrapperNotInstalledOnHost:
      "主機上尚未安裝「{wrapper}」。請在設定中改用其他啟動包裝器（例如 wine 或 umu-run）。",
    foreignWinePrefix:
      "{prefix} 中的 prefix 是由另一個 Wine 建立的，{wrapper} 會將它永久轉換（可能破壞擁有它的那個程式）。請選擇一個空資料夾以建立新的 prefix，或清空此欄位以使用預設值。",

    unsupportedLinkScheme: "只能開啟 http(s) 連結。",

    io: "檔案錯誤：{detail}",
    network: "網路錯誤：{detail}",
    badArchive: "壓縮檔無效：{detail}",
    badArchiveEntry: "壓縮檔中有一項的名稱無法使用：{detail}",
    badJson: "無法解析的回應：{detail}",
    downloadFailed: "下載失敗（{url}）：{detail}",
    modDownloadFailed: "模組下載失敗：{detail}",
    launchFailed: "啟動失敗（{command}）：{detail}",
    signInUnreachable: "無法連線登入服務：{detail}",
    noAppDataDir: "沒有可用的應用程式資料目錄：{detail}",
    runtimeNotExecutable: "無法將 umu-run 設為可執行：{detail}",
    patchVersionWriteFailed: "修補已套用，但無法寫入 version.txt：{detail}",
    launcherStageFailed: "無法暫存執行中的執行檔：{detail}",
    launcherInstallFailed: "無法安裝新的執行檔：{detail}",
    launcherRestartFailed: "已更新，但啟動器無法重新啟動：{detail}",
    backgroundTaskFailed: "有一項背景工作失敗了：{detail}",
    unknown: "出了點問題（{code}）。",
  },
};
