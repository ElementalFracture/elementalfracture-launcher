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
      runAsAdmin: "以系統管理員身分執行",
      runAsAdminHelp:
        "以系統管理員身分啟動啟動器，以及由它啟動的遊戲。僅在 Spellbreak 資料夾無法以其他方式寫入時（例如位於 Program Files 中）才需要。下次啟動啟動器時生效。",
    },
    steam: {
      title: "Steam",
      closeSteam: "關閉 Steam",
      closing: "正在要求 Steam 結束…",
      closeFirst: "請先關閉 Steam 再變更這些設定。Steam 結束時會儲存自己的設定，並還原這裡的變更。",
      noUser: "請先在這台電腦上登入一次 Steam，再變更這些設定。",
      link: "從 Steam 啟動 Spellbreak",
      linkHelp: "在 Steam 收藏庫中點擊 Spellbreak 的「開始遊戲」會開啟本啟動器。Steam 會把它當作 Spellbreak，因此控制器配置、遊戲內覆蓋和遊戲時數都能正常運作。你的 Elemental Fracture 檔案保持原位。",
      linkUnavailable: "請先在 Steam 中安裝 Spellbreak。Steam 只會為已安裝的遊戲顯示「開始遊戲」，但遊戲仍從你的 Elemental Fracture 資料夾執行。",
      linked: "現在在 Steam 中點擊 Spellbreak 的「開始遊戲」會開啟 Elemental Fracture。",
      unlinked: "Spellbreak 在 Steam 中的「開始遊戲」按鈕已恢復原狀。",
      quickstart: "直接進入遊戲",
      quickstartHelp: "在 Steam 中點擊 Spellbreak 的「開始遊戲」會直接啟動遊戲，不顯示啟動器，並使用你上次選擇的遊戲模式。若想開啟啟動器（例如切換遊戲模式），請在點擊「開始遊戲」時按住 Shift，直到啟動器出現。有更新需要安裝或需要登入時，啟動器也會自動開啟。",
      shortcut: "將 Elemental Fracture 加入 Steam",
      shortcutHelp: "把啟動器作為非 Steam 遊戲（附封面圖）加入你的 Steam 收藏庫，這樣你就能為它設定 Steam 控制器配置。如果你沒有在 Steam 上擁有 Spellbreak，請使用此項。",
      shortcutLinux: "在 Linux 上，請確認啟動包裝器中已選擇 Steam。",
      added: "已加入你的 Steam 收藏庫。",
      removed: "已從你的 Steam 收藏庫移除。",
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
      noDxvkTag: "（無 DXVK，不建議）",
      noDxvk:
        "純 Wine 會在沒有 DXVK 的情況下執行遊戲：角色顯示為白色且執行緩慢。點擊「啟動」時，啟動器會切換到 umu-run（Proton）。",
      placeholder: "例如 umu-run",
      placeholderNone: "例如 umu-run（未偵測到；請安裝 Wine 或 umu）",
      prefix: "Wine prefix",
      prefixHelp: "（選填；以 WINEPREFIX 傳入，留空則由啟動器自行建立）",
      prefixPlaceholder: "例如 /home/you/.wineprefixes/spellbreak",
      pickPrefix: "選擇一個 Wine prefix 資料夾",
      browse: "瀏覽…",
      proton: "Proton 版本",
      protonHelp: "（供 umu-run 使用；自動優先選擇最新的 GE-Proton）",
      protonAuto: "自動",
      protonMissing: "{path}（未安裝 — 將使用自動）",
      steam: "Steam",
      steamId: "Steam 遊戲 ID",
      steamIdHelp: "（遊戲的 Steam 桌面捷徑中 steam://rungameid/ 之後的數字）",
      steamIdPlaceholder: "例如 18150169937639899136",
      steamIdDetected: "已從遊戲的 Steam 捷徑偵測到。",
      steamIdDetectedOther: "偵測到的 Elemental Fracture 遊戲 ID 為：",
      steamIdCopy: "點擊複製",
      steamIdCopied: "已複製遊戲 ID。",
      steamIdCopyFailed: "無法複製遊戲 ID。",
      steamProton: "Proton 版本",
      steamProtonHelp: "（遊戲的 Steam 相容性設定；需關閉 Steam 才能更改）",
      steamProtonDefault: "Steam 預設",
      steamProtonSet: "Steam 將使用此 Proton 版本執行遊戲。",
    },
    urls: {
      title: "網址",
      cdn: "CDN 位址",
      cdnHelp: "（遊戲與啟動器更新的下載來源）",
      auth: "驗證網址",
      authHelp: "（工作階段驗證端點；遊戲伺服器主機由它推導而來）",
      players: "玩家數網址",
      playersHelp: "（玩家數服務端點）",
    },
    reset: {
      button: "重設設定",
      confirm: "再按一次以確認重設",
      title: "將此頁面的設定還原為預設值",
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
    createOne: "註冊一個",
    needHelp: "需要協助？",
    quickStart: "快速上手指南",
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
    afterGame: "遊戲關閉後將安裝 v{version}",
    dismiss: "略過",
  },

  topbar: {
    logo: "Elemental Fracture — 開啟 elefrac.com",
    logoTitle: "開啟 elefrac.com",
    players: {
      title: "線上玩家：點擊查看詳情",
      label: "名玩家在線上",
      label_other: "名玩家在線上",
      inMatch: "對戰中",
      inMenus: "在選單中",
      empty: "沒有伺服器回報。",
      live: "對戰進行中",
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
      sessionExpired: "工作階段已過期，請重新登入。",
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
      verifyBase: "正在驗證遊戲檔案",
      downloadPatch: "正在下載更新",
      extractPatch: "正在安裝更新",
      installMods: "正在安裝模組",
      downloadPlaytest: "正在下載測試版本",
      extractPlaytest: "正在安裝測試版本",
      done: "完成",
    },
  },

  folder: {
    steamCopy:
      "這是 Steam 版的 Spellbreak。Elemental Fracture 無法從這裡執行：Steam 會不斷還原它自己的檔案。請改用「下載遊戲」安裝 Elemental Fracture 自己的副本。",
    epicCopy:
      "這是 Epic Games 版的 Spellbreak。Elemental Fracture 無法從這裡執行：Epic 會不斷還原它自己的檔案。請改用「下載遊戲」安裝 Elemental Fracture 自己的副本。",
    oneDrive:
      "此資料夾位於 OneDrive 中。OneDrive 在同步時會鎖定並還原檔案，導致更新無法保留，遊戲一直執行舊檔案。請將 Spellbreak 資料夾移到 C:\\Games 等位置，然後重新定位（或將遊戲下載到那裡）。",
    notWritable:
      "啟動器無法寫入 {path}，因此無法在那裡安裝更新和模組。請將 Spellbreak 資料夾移到 C:\\Games 等位置，或在設定中開啟「以系統管理員身分執行」。",
    fixed:
      "已修復 Spellbreak 資料夾的權限，現在可以安裝更新了。",
    adminTitle:
      "需要權限",
    adminMessage:
      "Elemental Fracture 無法寫入位於 {path} 的 Spellbreak 資料夾，因此無法安裝更新和模組。要以系統管理員身分重新啟動啟動器嗎？之後它將一律以系統管理員身分啟動（可在設定中關閉）。",
  },
  game: {
    title: "遊戲",
    version: "(v{version})",
    locate: "尋找安裝位置",
    checkUpdates: "檢查遊戲更新",
    checking: "檢查中…",
    forceUpdate: "強制更新至最新版本",
    forcing: "更新中…",
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
    repair: "驗證遊戲檔案",
    repairing: "正在檢查遊戲檔案…",
    repairChecked: "已檢查 {count} 個遊戲檔案，沒有缺少。",
    repairFixed: "已還原 {count} 個遊戲檔案。",
    repairFixed_other: "已還原 {count} 個遊戲檔案。",
    repairStuck: "有 {count} 個檔案無法還原。請重試；若持續發生，請回報給我們。",
    repairStuck_other: "有 {count} 個檔案無法還原。請重試；若持續發生，請回報給我們。",
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
    launcherUpdateWaitsForGame:
      "遊戲關閉後啟動器將自動更新。",
    extractionMismatch:
      "重新解壓縮後仍有 {count} 個遊戲檔案與下載內容不一致：{files}。有程式在寫入時修改了檔案 — 通常是防毒軟體。請將遊戲資料夾加入排除清單後重新安裝；已下載的檔案會保留，不會重複下載。",
    notEnoughSpace:
      "{path} 磁碟空間不足：安裝需要 {need} 可用空間，目前只有 {free}。在檔案驗證完成之前，下載檔案和解壓縮後的遊戲需要同時存放。",
    archiveMissingGameFolder:
      "解壓縮出的檔案中沒有 g3 資料夾：壓縮檔結構不如預期。",
    runtimeArchiveCorrupt: "執行環境壓縮檔已損毀或不完整。",
    runtimeNeedsPython:
      "找不到遊戲執行環境，且缺少 python3（umu / Proton 需要它）。請用你的套件管理器安裝 python3，或改為安裝 Wine，然後再試一次。",
    launcherVersionUnreadable: "無法從 CDN 讀取啟動器版本。",
    archiveTooLarge:
      "此下載解壓後為 {size}，超過 {limit} 的上限——已拒絕，以免佔滿磁碟。請重試；如果反覆出現，請回報。",

    archiveListingUnavailable:

      "無法從 {url} 讀取遊戲下載的檔案列表，因此無法據此驗證安裝。通常是網路或 CDN 的暫時問題，請稍後重試。",


    pakSignatureMissing:


      "遊戲無法啟動：{paks} 中缺少 {file}，已簽章的 pak 沒有它就無法載入。開啟「Mods」並執行「驗證遊戲檔案」即可還原。",



    manifestSignatureInvalid:
      "CDN 上的發佈清單未經 Elemental Fracture 簽署。未安裝任何內容。請稍後再試；若持續發生，請回報。",
    manifestRolledBack:
      "CDN 提供的發佈清單（版本 {offered}）比此啟動器已接受的版本（{seen}）更舊。未安裝任何內容。",
    manifestMissingFile:
      "發佈清單中沒有 {file} 的項目，因此無法驗證。未安裝任何內容。",
    downloadHashMismatch:
      "{file} 與已發佈的校驗和不符，已丟棄。請再試一次；若持續發生，請回報。",
    manifestUnavailable:
      "無法從 CDN 取得發佈清單：{detail}",

    notSignedIn: "你尚未登入。",
    playersUrlNotConfigured: "尚未設定玩家數網址。",
    enterEmailAndPassword: "請輸入你的電子郵件與密碼。",
    signInNotConfigured: "尚未設定登入。",
    signInFailed: "登入失敗。請再試一次。",
    wrongCredentials: "電子郵件或密碼錯誤。",
    emailUnverified: "請先驗證你的電子郵件，驗證碼在你的收件匣裡。",
    passwordChangeRequired:
      "你使用了臨時密碼登入。請先在 elefrac.com 登入並設定你自己的密碼，然後在這裡用新密碼登入。",
    tempPasswordExpired:
      "這個臨時密碼已過期。請向工作人員索取新密碼，或在 elefrac.com 重設密碼。",
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

    steamNotFound: "這台電腦上沒有安裝 Steam。",
    steamRunning: "請先關閉 Steam。它結束時會儲存自己的設定，並還原這裡的變更。",
    steamNoUser: "請先在這台電腦上登入一次 Steam，然後再試一次。",
    spellbreakNotInSteam: "這台電腦上的 Spellbreak 不是透過 Steam 安裝的。",

    unsupportedLinkScheme: "只能開啟 http(s) 連結。",

    io: "檔案錯誤：{detail}",
    network: "網路錯誤：{detail}",
    badArchive: "壓縮檔無效：{detail}",
    badArchiveEntry: "壓縮檔中有一項的名稱無法使用：{detail}",
    badJson: "無法解析的回應：{detail}",
    downloadFailed: "下載失敗（{url}）：{detail}",
    modDownloadFailed: "模組下載失敗：{detail}",
    steamConfigUnreadable: "無法讀取 Steam 的 {file}，因此未做任何變更：{detail}",
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
