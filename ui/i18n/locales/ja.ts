import type { Catalogue } from "../index";

/**
 * Japanese. Typed as `Catalogue`, so leaving a key out — or inventing one —
 * fails the build rather than falling back silently at runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (Wine, prefix, pak, CDN, umu-run,
 * Proton) are left in English on purpose, since that is what the surrounding
 * tooling and the community's own vocabulary use. So are the game's own
 * proper nouns: Spellbreak, Elemental Fracture, the Hollow Lands.
 *
 * Japanese has one plural form, so `Intl.PluralRules` always picks `_other`
 * here — the two forms of a counted string are deliberately identical.
 */
export const ja: Catalogue = {
  common: {
    moreInfo: "詳細情報",
    close: "閉じる",
    loading: "読み込み中",
    closeToast: "通知を閉じる",
  },

  settings: {
    launcher: {
      title: "ランチャー",
      version: "(v{version})",
      checkUpdates: "ランチャーの更新を確認",
      checking: "確認中…",
      upToDate: "ランチャーは最新です",
      unreachable:
        "更新サーバーに接続できませんでした。設定の CDN を確認してください。",
      minimizeOnClose: "閉じる（X）ときはタスクバーに最小化する",
      minimizeOnCloseHelp:
        "X を押すとランチャーは終了せずタスクバーに隠れ、バックグラウンドで動き続けます。完全に終了するにはトレイやタスクバーのアイコンから操作してください。",
      closeOnLaunch: "ゲーム開始時にランチャーを閉じる",
      closeOnLaunchHelp:
        "ゲームが起動した少しあとにランチャーを自動で閉じ、プレイ中のメモリを解放します。",
    },
    language: {
      title: "言語",
      label: "表示言語",
      help: "すぐに反映されます。「システム」は OS の言語に従い、ランチャーが対応していない言語のときは英語になります。",
      system: "システム",
    },
    wrapper: {
      title: "起動ラッパー",
      command: "コマンド",
      commandHelp: "（ゲームの exe を実行します — Proton-GE 推奨）",
      custom: "カスタム…",
      placeholder: "例: umu-run",
      placeholderNone:
        "例: umu-run（未検出。Wine か umu をインストールしてください）",
      prefix: "Wine prefix",
      prefixHelp:
        "（任意。WINEPREFIX として渡されます。空ならランチャーが自前で作成します）",
      prefixPlaceholder: "例: /home/you/.wineprefixes/spellbreak",
      pickPrefix: "Wine prefix のフォルダーを選択",
      browse: "参照…",
    },
    urls: {
      title: "URL",
      cdn: "CDN のベース URL",
      cdnHelp: "（ゲームとランチャーの更新の取得元）",
      auth: "認証 URL",
      authHelp:
        "（セッション検証エンドポイント。ゲームサーバーのホストはここから導出されます）",
      players: "プレイヤー数 URL",
      playersHelp: "（プレイヤー数サービスのエンドポイント）",
    },
    reset: {
      button: "設定をリセット",
      confirm: "もう一度クリックでリセット",
      title: "ランチャーの設定をすべて消去し、初回セットアップをやり直します",
      done: "設定をリセットしました",
    },
  },

  wizard: {
    welcomeTitle: "Elemental Fracture へようこそ",
    welcomeSub: "来てくれてうれしいです。",
    next: "次へ",
    gameTitle: "ゲームのセットアップは済んでいますか？",
    gameSub:
      "この PC にすでに Spellbreak があるなら、そのフォルダーをランチャーに教えるだけで完了です。",
    gameNo: "いいえ、まだです",
    gameYes: "はい、インストール先を探す",
    looking: "既存のインストールを探しています…",
    pickFolder:
      "Spellbreak のフォルダーを選択してください（g3 と Engine を含みます）",
    noFolder: "フォルダーは選ばれていません。設定からいつでも指定できます。",
    hooked: "見つかりました: {path}、{step}",
    installingMods: "更新と MOD をインストール中…",
    skip: "今はスキップ",
    doneTitle: "準備完了です！",
    doneTitleNamed: "準備完了です、{name}！",
    doneSub: "Hollow Lands はまだあなたを呼んでいます、breaker。",
    enter: "ランチャーへ",
  },

  account: {
    title: "Elemental Fracture にサインイン",
    sub: "Elemental Fracture のメールアドレスとパスワードを使ってください — ウェブサイトと同じアカウントです。",
    email: "メールアドレス",
    password: "パスワード",
    signIn: "サインイン",
    signingIn: "サインイン中…",
    forgot: "パスワードをお忘れですか？",
    createOne: "作成する",
    needHelp: "お困りですか？",
    quickStart: "クイックスタートガイド",
    welcomeBack: "おかえりなさい、{name}！",
    welcomeBackAs: "おかえりなさい、{name}（{role}）！",
    roleDev: "開発者",
    roleStaff: "スタッフ",
    roleTester: "テスター",
  },

  footer: {
    connect: "参加",
    connectTitle: "Discord に参加",
    donate: "支援",
    donateTitle: "Patreon で支援",
    patchNotes: "パッチノート",
  },

  update: {
    title: "ランチャーの更新があります",
    installing: "インストール中…",
    ready: "v{version} の準備ができました · クリックで更新",
    click: "クリックで更新",
    dismiss: "閉じる",
  },

  topbar: {
    logo: "Elemental Fracture — elefrac.com を開く",
    logoTitle: "elefrac.com を開く",
    ingame: {
      title: "ゲーム中のプレイヤー: クリックで内訳を表示",
      label: "ゲーム中",
      empty: "ゲーム中のプレイヤーはいません",
      mode: "モード",
      other: "その他",
      /* Mode names as the community says them, like the nouns above. */
      modes: {
        solos: "Solos",
        duos: "Duos",
        squads: "Squads",
        arena: "Arena/TDM",
      },
    },
    variant: {
      group: "ゲームのバージョン",
      enabling: "有効化しています…",
      enable: "Playtest を有効にする",
      difference: "違いは？",
      efHelp:
        "*Elemental Fracture* はコミュニティ版です。作り直されたタレント、新しいバランス、そして継続的な更新。",
      classicHelp:
        "*Classic* はサービス終了時そのままの Spellbreak です。当時のバランスを手つかずで保存しています。",
      playtestHelp:
        "*Playtest* は非公開のプレイテスト用チャンネルです。未公開のバランスをテスターが先行して試せます。",
      efTitle: "Elemental Fracture のバランス",
      classicTitle: "Spellbreak Classic",
      playtestTitle: "非公開のプレイテストビルド",
    },
    account: {
      title: "アカウント",
      guest: "ゲスト",
      signIn: "サインイン",
      sessionExpired: "セッションの有効期限切れ",
      signOut: "サインアウト",
      signedOut: "サインアウトしました。",
      closeFriends: "フレンドリストを閉じる",
      you: "あなた",
      developer: "開発者",
      staff: "スタッフ",
      tester: "テスター",
    },
  },

  friends: {
    add: "追加",
    addTitle: "フレンド申請を送る",
    addPlaceholder: "Spellbreak ID（ユーザー名）で追加",
    loading: "読み込み中…",
    none: "まだフレンドがいません。上の欄から Spellbreak ID で追加してみましょう。",
    onlineSection: "フレンド（{n}）",
    onlineEmpty: "今はオンラインの人がいません。",
    requestsSection: "申請（{n}）",
    offlineSection: "オフライン（{n}）",
    offlineEmpty: "オフラインのフレンドはいません。",
    requested: "申請中",
    inGame: "ゲーム中",
    online: "オンライン",
    offline: "オフライン",
    remove: "フレンドを削除",
    accept: "承認",
    decline: "拒否",
    cancelRequest: "申請を取り消す",
    actionFor: "{action}: {name}",
    confirmTitle: "{name} を削除しますか？",
    confirmBody: "{name} をフレンドリストから削除します。",
    confirmCancel: "キャンセル",
    confirmRemove: "削除",
    errors: {
      userNotFound: "その Spellbreak ID のプレイヤーは見つかりません。",
      cannotFriendSelf: "それはあなた自身です！",
      sessionExpired:
        "セッションの有効期限が切れました。もう一度サインインしてください。",
      usernameRequired: "Spellbreak ID を入力してください。",
      noPendingRequest: "その人からの保留中の申請はありません。",
      unavailable: "フレンドサーバーに接続できません。もう一度お試しください。",
    },
  },

  sidebar: {
    home: "ホーム",
    mods: "ゲーム設定",
    settings: "ランチャー設定",
    about: "情報",
  },

  home: {
    greeting: {
      fallbackName: "breaker",
      night: "夜更かしですか、{name}？",
      nightAlt: "Hollow Lands は眠りません、{name}。",
      morning: "おはようございます、{name}！",
      morningAlt: "起きて呪文を、{name}！",
      afternoon: "こんにちは、{name}！",
      afternoonAlt: "魔法の嵐にうってつけの天気ですね、{name}。",
      evening: "こんばんは、{name}！",
      eveningAlt: "日が暮れると嵐が来ます、{name}。",
    },
    hero: {
      efTitle: "Hollow Lands はまだあなたを呼んでいます、breaker",
      efSub:
        "コミュニティサーバー、よみがえった戦い、新しいバランス。Spellbreak は続きます。",
      classicTitle: "Hollow Lands、あのころのままに。",
      classicSub:
        "コミュニティサーバー、よみがえった戦い、当時のバランス。Spellbreak をそのまま。",
      playtestTitle: "Hollow Lands、嵐の一歩先へ。",
      playtestSub:
        "未公開のバランスを、テスターの皆さんへ。粗さは残ります。あなたのフィードバックが実装される内容を形づくります。",
    },
    install: {
      noInstall:
        "Spellbreak のインストールが設定されていません。既存のインストールを探すか、ゲームをダウンロードしてください。",
      exeMissing:
        "設定されたフォルダーに Spellbreak.exe が見つかりませんでした。正しいフォルダーを指定するか、ダウンロードし直してください。",
      locate: "既存のインストールを探す",
      download: "ゲームをダウンロード…",
    },
    launch: {
      launch: "起動",
      launchTitle: "Spellbreak を起動",
      updatingTitle: "ゲームを更新しています…",
      update: "更新",
      updating: "更新中",
      updateTitle: "ゲーム更新 v{version} をダウンロード",
      updateTitleUnknown: "ゲームの更新をダウンロード",
      downloadingTitle: "ゲームの更新をダウンロードしています…",
      hint: "バージョン {version} が公開されました — 更新するとプレイできます。",
      hintUnknown: "ゲームの更新があります — 更新するとプレイできます。",
      patchShipped:
        "ゲームの更新が公開されました — プレイ前に更新してください。",
      launching: "Spellbreak を起動しています…",
    },
    events: {
      title: "開催中のイベント",
      live: "開催中",
      interested: "{count} 人が興味あり",
      interested_other: "{count} 人が興味あり",
      inMinutes: "{when}（{minutes} 分後）",
      inHours: "{when}（{hours} 時間後）",
    },
    news: {
      title: "お知らせ",
      empty: "今はお知らせがありません。",
    },
    stages: {
      downloadBase: "ゲームをダウンロード中",
      extractBase: "ゲームを展開中",
      downloadPatch: "更新をダウンロード中",
      extractPatch: "更新をインストール中",
      installMods: "MOD をインストール中",
      downloadPlaytest: "プレイテストビルドをダウンロード中",
      extractPlaytest: "プレイテストビルドをインストール中",
      done: "完了",
    },
  },

  game: {
    title: "ゲーム",
    version: "(v{version})",
    locate: "インストール先を探す",
    checkUpdates: "ゲームの更新を確認",
    checking: "確認中…",
    forceUpdate: "最新のアップデートを強制",
    forcing: "更新中…",
    download: "ゲームをダウンロード…",
    location: "インストール先",
    locationPlaceholder: "未設定",
    browse: "参照…",
    save: "保存",
    noFolder:
      "ゲームフォルダーが未設定です — 「探す」またはゲームのダウンロードを使ってください。",
    pickFolder: "Spellbreak のフォルダーを選択してください",
    pickDestination: "Spellbreak のインストール先を選択（約 25 GB 必要）",
    folderSet: "ゲームフォルダーを設定しました: {path}",
    folderUpdated: "ゲームフォルダーを更新しました",
    updateAvailable:
      "ゲームの更新があります（v{version}）— ホームから実行してください。",
    upToDate: "ゲームは最新です",
    unreachable:
      "更新サーバーに接続できませんでした。設定の CDN を確認してください。",
    downloading:
      "インストール中: 大きなダウンロードです。ランチャーは開いたままにしてください。",
    downloaded: "ゲームを {path} にインストールしました",
    downloadFailed: "インストールに失敗しました: {detail}",
    alreadyCurrent: "すでに最新です（v{version}）",
    provisioning: "更新と MOD をインストール中…",
    provisioned: "インストールの準備ができました（v{version}）",
    provisionedUnknown: "インストールの準備ができました",
    provisionFailed: "インストールを更新できませんでした: {detail}",
    updated: "ゲームを v{version} に更新しました",
    updatedUnknown: "ゲームを更新しました",
    updateFailed: "更新に失敗しました: {detail}",
  },

  mods: {
    title: "MOD",
    verify: "検証",
    verifying: "検証中…",
    update: "ゲームを更新",
    updating: "更新中…",
    install: "MOD をインストール / 更新",
    installing: "インストール中…",
    checkingFiles: "MOD のファイルを確認中…",
    installedBadge: "インストール済み",
    missingBadge: "未インストール",
    ready: "MOD はインストール済みで、準備できています。",
    absent: "MOD はインストールされていません。",
    partial: "一部の MOD ファイルが不足しています。",
    noFolder:
      "先にゲームフォルダーを設定してください — 上の「探す」か「ダウンロード」を使います。",
    missingCount:
      "{total} 個中 {count} 個のファイルが不足しています — 「MOD をインストール / 更新」を実行してください。",
    missingCount_other:
      "{total} 個中 {count} 個のファイルが不足しています — 「MOD をインストール / 更新」を実行してください。",
    patched: "v{version} に更新しました",
    patchedUnknown: "パッチを更新しました",
    installDone: "MOD をインストールしました",
    installFailed: "インストールに失敗しました",
  },

  errors: {
    noGameFolder: "先にゲームフォルダーを設定してください（設定）。",
    notSpellbreakInstall:
      "このフォルダーは Spellbreak のインストール先ではないようです（g3/Binaries/Win64 がありません）。",
    paksNotFound: "Paks フォルダーが見つかりません: {path}",
    unknownVariant: "不明なバリアント: {variant}",
    variantPakMissing:
      "{pak} が Paks フォルダーにありません: 先に「MOD をインストール / 更新」を実行してください。",
    playtestPakMissing:
      "{pak} がインストールされていません: 先に Playtest ビルドを有効にしてダウンロードしてください。",
    noGameBinary:
      "{dir} にゲームの実行ファイルが見つかりません（探したのは {names}）",

    modArchiveTooSmall:
      "ダウンロードした mod.zip が不自然に小さいです: CDN がエラーページを返した可能性があります。",
    launcherArchiveTooSmall:
      "ダウンロードしたランチャーが不自然に小さいです: CDN がエラーページを返した可能性があります。",
    playtestArchiveEmpty:
      "プレイテストのアーカイブに .pak ファイルが含まれていませんでした。",
    runtimeMissingUmu:
      "ランタイムのアーカイブ内に umu-run が見つかりませんでした。",
    rangeRequestsUnsupported:
      "サーバーが range リクエストを受け付けなくなりました。",
    downloadStalled:
      "ダウンロードが停止しました（範囲 {range}、残り {remaining}）。",
    launcherUpdateDisabledInDev:
      "開発ビルドではランチャーの自動更新は無効です（EF_LAUNCHER_UPDATE=1 を設定してください）。",
    extractionIncomplete:
      "展開が不完全です: {expected} 個中 {written} 個のファイルを書き込みました。ダウンロードが壊れている可能性が高いです — インストールフォルダーを削除して、もう一度ダウンロードしてください。",
    archiveMissingGameFolder:
      "展開したファイルに g3 フォルダーがありません: 想定外のアーカイブ構造です。",
    runtimeArchiveCorrupt: "ランタイムのアーカイブが壊れているか、不完全です。",
    runtimeNeedsPython:
      "ゲームのランタイムが見つからず、python3 もありません（umu / Proton に必要です）。パッケージマネージャーで python3 をインストールするか、Wine をインストールしてから、もう一度お試しください。",
    launcherVersionUnreadable:
      "CDN からランチャーのバージョンを読み取れませんでした。",
    archiveTooLarge:
      "このダウンロードは展開すると {size} になり、{limit} の上限を超えます — ディスクを埋める代わりに拒否しました。もう一度お試しください。繰り返す場合は報告してください。",

    manifestSignatureInvalid:
      "CDN 上のリリースマニフェストは Elemental Fracture によって署名されていません。何もインストールされませんでした。後でもう一度お試しください。続く場合は報告してください。",
    manifestRolledBack:
      "CDN が提供しているリリース一覧（バージョン {offered}）は、このランチャーが既に受け入れたもの（{seen}）より古いものです。何もインストールされませんでした。",
    manifestMissingFile:
      "リリースマニフェストに {file} の項目がないため、検証できません。何もインストールされませんでした。",
    downloadHashMismatch:
      "{file} が公開されているチェックサムと一致しなかったため破棄しました。もう一度お試しください。続く場合は報告してください。",
    manifestUnavailable:
      "CDN からリリースマニフェストを取得できませんでした: {detail}",

    notSignedIn: "サインインしていません。",
    playersUrlNotConfigured: "プレイヤー数 URL が設定されていません。",
    enterEmailAndPassword: "メールアドレスとパスワードを入力してください。",
    signInNotConfigured: "サインインが設定されていません。",
    signInFailed: "サインインに失敗しました。もう一度お試しください。",
    wrongCredentials: "メールアドレスまたはパスワードが違います。",
    emailUnverified:
      "先にメールアドレスを確認してください。コードは受信トレイにあります。",
    rateLimited: "試行回数が多すぎます。数分お待ちください。",
    accountSuspended: "このアカウントは停止されています。",
    accountSuspendedPermanent: "このアカウントは永久に停止されています。",
    accountSuspendedUntil:
      "このアカウントは停止されています。停止は {ends} に解除されます。",
    suspensionReason: "理由: {reason}",

    wrapperNotInstalled:
      "「{wrapper}」がインストールされていません。設定で別の起動ラッパーを選んでください（例: wine や umu-run）。",
    wrapperNotInstalledOnHost:
      "ホストに「{wrapper}」がインストールされていません。設定で別の起動ラッパーを選んでください（例: wine や umu-run）。",
    foreignWinePrefix:
      "{prefix} の prefix は別の Wine が作成したもので、{wrapper} はそれを恒久的に変換してしまいます（その prefix を使っているアプリが壊れるおそれがあります）。空のフォルダーを選んで新しい prefix を作るか、欄を空にして既定の prefix を使ってください。",

    unsupportedLinkScheme: "開けるのは http(s) のリンクだけです。",

    io: "ファイルエラー: {detail}",
    network: "ネットワークエラー: {detail}",
    badArchive: "アーカイブが不正です: {detail}",
    badArchiveEntry: "アーカイブ内の項目名が使用できません: {detail}",
    badJson: "応答を読み取れません: {detail}",
    downloadFailed: "ダウンロードに失敗しました（{url}）: {detail}",
    modDownloadFailed: "MOD のダウンロードに失敗しました: {detail}",
    launchFailed: "起動に失敗しました（{command}）: {detail}",
    signInUnreachable: "サインインサービスに接続できませんでした: {detail}",
    noAppDataDir: "アプリのデータディレクトリが利用できません: {detail}",
    runtimeNotExecutable: "umu-run に実行権限を付けられませんでした: {detail}",
    patchVersionWriteFailed:
      "パッチは適用しましたが、version.txt を書き込めませんでした: {detail}",
    launcherStageFailed: "実行中のバイナリを退避できませんでした: {detail}",
    launcherInstallFailed:
      "新しいバイナリをインストールできませんでした: {detail}",
    launcherRestartFailed:
      "更新はできましたが、ランチャーを再起動できませんでした: {detail}",
    backgroundTaskFailed: "バックグラウンドの処理が失敗しました: {detail}",
    unknown: "問題が発生しました（{code}）。",
  },
};
