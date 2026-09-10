import type { Catalogue } from "../index";

/**
 * Korean. Typed as `Catalogue`, so leaving a key out — or inventing one —
 * fails the build rather than falling back silently at runtime.
 *
 * Machine-assisted and not yet reviewed by a native speaker; the technical
 * nouns the launcher shares with the game (Wine, prefix, pak, CDN, umu-run,
 * Proton) are left in English on purpose, since that is what the surrounding
 * tooling and the community's own vocabulary use. So are the game's own
 * proper nouns: Spellbreak, Elemental Fracture, the Hollow Lands.
 *
 * Korean has one plural form, so `Intl.PluralRules` always picks `_other`
 * here — the two forms of a counted string are deliberately identical.
 */
export const ko: Catalogue = {
  common: {
    moreInfo: "자세히",
    close: "닫기",
    loading: "불러오는 중",
    closeToast: "알림 닫기",
  },

  settings: {
    launcher: {
      title: "런처",
      version: "(v{version})",
      checkUpdates: "런처 업데이트 확인",
      checking: "확인 중…",
      upToDate: "런처가 최신 상태입니다",
      unreachable:
        "업데이트 서버에 연결하지 못했습니다. 설정의 CDN 주소를 확인하세요.",
      minimizeOnClose: "닫을 때(X) 작업 표시줄로 최소화",
      minimizeOnCloseHelp:
        "X를 누르면 런처가 종료되지 않고 작업 표시줄에 숨겨져 백그라운드에서 계속 실행됩니다. 완전히 끄려면 트레이나 작업 표시줄 아이콘에서 종료하세요.",
      closeOnLaunch: "게임이 시작되면 런처 닫기",
      closeOnLaunchHelp:
        "게임이 실행된 직후 런처를 자동으로 닫아, 플레이하는 동안 메모리를 확보합니다.",
    },
    language: {
      title: "언어",
      label: "표시 언어",
      help: "바로 적용됩니다. ‘시스템’은 운영체제 언어를 따르며, 런처가 지원하지 않는 언어면 영어로 표시됩니다.",
      system: "시스템",
    },
    wrapper: {
      title: "실행 래퍼",
      command: "명령",
      commandHelp: "(게임 exe를 실행합니다 — Proton-GE 권장)",
      custom: "직접 입력…",
      placeholder: "예: umu-run",
      placeholderNone:
        "예: umu-run (감지되지 않음. Wine 또는 umu를 설치하세요)",
      prefix: "Wine prefix",
      prefixHelp:
        "(선택 사항. WINEPREFIX로 전달됩니다. 비워 두면 런처가 직접 만듭니다)",
      prefixPlaceholder: "예: /home/you/.wineprefixes/spellbreak",
      pickPrefix: "Wine prefix 폴더를 선택하세요",
      browse: "찾아보기…",
    },
    urls: {
      title: "URL",
      cdn: "CDN 주소",
      cdnHelp: "(게임과 런처 업데이트를 받아오는 곳)",
      auth: "인증 URL",
      authHelp: "(세션 검증 엔드포인트. 게임 서버 호스트는 여기서 유도됩니다)",
      players: "플레이어 수 URL",
      playersHelp: "(플레이어 수 서비스 엔드포인트)",
    },
    reset: {
      button: "설정 초기화",
      confirm: "초기화하려면 한 번 더 클릭",
      title: "런처 설정을 모두 지우고 초기 설정을 다시 진행합니다",
      done: "설정을 초기화했습니다",
    },
  },

  wizard: {
    welcomeTitle: "Elemental Fracture에 오신 것을 환영합니다",
    welcomeSub: "함께하게 되어 기쁩니다.",
    next: "다음",
    gameTitle: "게임을 설치해 본 적이 있나요?",
    gameSub:
      "이 컴퓨터에 Spellbreak가 이미 있다면, 그 폴더만 런처에 알려주면 끝입니다.",
    gameNo: "아니요, 아직 없습니다",
    gameYes: "네, 설치 위치를 찾아주세요",
    looking: "기존 설치를 찾는 중…",
    pickFolder: "Spellbreak 폴더를 선택하세요 (g3와 Engine이 들어 있습니다)",
    noFolder: "선택한 폴더가 없습니다. 설정에서 언제든 지정할 수 있습니다.",
    hooked: "찾았습니다: {path}, {step}",
    installingMods: "업데이트와 모드를 설치하는 중…",
    skip: "지금은 건너뛰기",
    doneTitle: "모두 준비됐습니다!",
    doneTitleNamed: "모두 준비됐습니다, {name}!",
    doneSub: "Hollow Lands가 여전히 당신을 부릅니다, breaker.",
    enter: "런처로 들어가기",
  },

  account: {
    title: "Elemental Fracture 로그인",
    sub: "Elemental Fracture 이메일과 비밀번호를 사용하세요 — 웹사이트와 같은 계정입니다.",
    email: "이메일",
    password: "비밀번호",
    signIn: "로그인",
    signingIn: "로그인 중…",
    forgot: "비밀번호를 잊으셨나요?",
    createOne: "만들기",
    needHelp: "도움이 필요하신가요?",
    quickStart: "빠른 시작 가이드",
    welcomeBack: "다시 오셨군요, {name}!",
    welcomeBackAs: "다시 오셨군요, {name}({role})!",
    roleDev: "개발자",
    roleStaff: "스태프",
    roleTester: "테스터",
  },

  footer: {
    connect: "참여",
    connectTitle: "Discord에 참여",
    donate: "후원",
    donateTitle: "Patreon에서 후원",
    patchNotes: "패치 노트",
  },

  update: {
    title: "런처 업데이트가 있습니다",
    installing: "설치 중…",
    ready: "v{version} 준비 완료 · 클릭해 업데이트",
    click: "클릭해 업데이트",
    dismiss: "닫기",
  },

  topbar: {
    logo: "Elemental Fracture — elefrac.com 열기",
    logoTitle: "elefrac.com 열기",
    ingame: {
      title: "게임 중인 플레이어: 클릭하면 자세히 볼 수 있습니다",
      label: "게임 중",
      empty: "게임 중인 사람이 없습니다",
      mode: "모드",
      other: "기타",
      /* Mode names as the community says them, like the nouns above. */
      modes: {
        solos: "Solos",
        duos: "Duos",
        squads: "Squads",
        arena: "Arena/TDM",
      },
    },
    variant: {
      group: "게임 버전",
      enabling: "활성화 중…",
      enable: "Playtest 활성화",
      difference: "무엇이 다른가요?",
      efHelp:
        "*Elemental Fracture*는 커뮤니티 에디션입니다. 재설계된 특성, 새로운 밸런스, 그리고 계속되는 업데이트.",
      classicHelp:
        "*Classic*은 서비스 종료 당시 그대로의 Spellbreak입니다. 원래 밸런스를 손대지 않고 보존했습니다.",
      playtestHelp:
        "*Playtest*는 비공개 테스트 채널입니다. 아직 공개되지 않은 밸런스를 테스터가 먼저 시험해 봅니다.",
      efTitle: "Elemental Fracture 밸런스",
      classicTitle: "Spellbreak Classic",
      playtestTitle: "비공개 플레이테스트 빌드",
    },
    account: {
      title: "계정",
      guest: "게스트",
      signIn: "로그인",
      sessionExpired: "세션 만료됨",
      signOut: "로그아웃",
      signedOut: "로그아웃했습니다.",
      closeFriends: "친구 목록 닫기",
      you: "나",
      developer: "개발자",
      staff: "스태프",
      tester: "테스터",
    },
  },

  friends: {
    add: "추가",
    addTitle: "친구 요청 보내기",
    addPlaceholder: "Spellbreak ID(사용자 이름)로 추가",
    loading: "불러오는 중…",
    none: "아직 친구가 없습니다. 위에서 Spellbreak ID로 추가해 보세요.",
    onlineSection: "친구 ({n})",
    onlineEmpty: "지금 접속 중인 사람이 없습니다.",
    requestsSection: "요청 ({n})",
    offlineSection: "오프라인 ({n})",
    offlineEmpty: "오프라인 친구가 없습니다.",
    requested: "요청함",
    inGame: "게임 중",
    online: "온라인",
    offline: "오프라인",
    remove: "친구 삭제",
    accept: "수락",
    decline: "거절",
    cancelRequest: "요청 취소",
    actionFor: "{action}: {name}",
    confirmTitle: "{name} 님을 삭제할까요?",
    confirmBody: "{name} 님을 친구 목록에서 삭제합니다.",
    confirmCancel: "취소",
    confirmRemove: "삭제",
    errors: {
      userNotFound: "해당 Spellbreak ID를 쓰는 플레이어가 없습니다.",
      cannotFriendSelf: "본인이잖아요!",
      sessionExpired: "세션이 만료되었습니다. 다시 로그인하세요.",
      usernameRequired: "Spellbreak ID를 입력하세요.",
      noPendingRequest: "그 사람에게서 온 대기 중인 요청이 없습니다.",
      unavailable: "친구 서버를 사용할 수 없습니다. 다시 시도하세요.",
    },
  },

  sidebar: {
    home: "홈",
    mods: "게임 설정",
    settings: "런처 설정",
    about: "정보",
  },

  home: {
    greeting: {
      fallbackName: "breaker",
      night: "밤을 새우는 중인가요, {name}?",
      nightAlt: "Hollow Lands는 잠들지 않습니다, {name}.",
      morning: "좋은 아침입니다, {name}!",
      morningAlt: "일어나서 주문을 외울 시간입니다, {name}!",
      afternoon: "좋은 오후입니다, {name}!",
      afternoonAlt: "마법 폭풍을 부르기 딱 좋은 날씨네요, {name}.",
      evening: "좋은 저녁입니다, {name}!",
      eveningAlt: "해질 무렵 폭풍이 몰려옵니다, {name}.",
    },
    hero: {
      efTitle: "Hollow Lands가 여전히 당신을 부릅니다, breaker",
      efSub:
        "커뮤니티 서버, 되살아난 전투, 새로운 밸런스. Spellbreak는 계속됩니다.",
      classicTitle: "Hollow Lands, 그 시절 그대로.",
      classicSub:
        "커뮤니티 서버, 되살아난 전투, 원래의 밸런스. Spellbreak를 그대로 보존했습니다.",
      playtestTitle: "Hollow Lands, 폭풍보다 한 발 앞서.",
      playtestSub:
        "아직 공개되지 않은 밸런스를 테스터에게. 거친 부분이 있을 수 있습니다. 여러분의 피드백이 최종 결과를 만듭니다.",
    },
    install: {
      noInstall:
        "설정된 Spellbreak 설치가 없습니다. 기존 설치를 찾거나 게임을 내려받으세요.",
      exeMissing:
        "설정된 폴더에서 Spellbreak.exe를 찾지 못했습니다. 올바른 폴더를 지정하거나 다시 내려받으세요.",
      locate: "기존 설치 찾기",
      download: "게임 내려받기…",
    },
    launch: {
      launch: "실행",
      launchTitle: "Spellbreak 실행",
      updatingTitle: "게임을 업데이트하는 중…",
      update: "업데이트",
      updating: "업데이트 중",
      updateTitle: "게임 업데이트 v{version} 내려받기",
      updateTitleUnknown: "게임 업데이트 내려받기",
      downloadingTitle: "게임 업데이트를 내려받는 중…",
      hint: "버전 {version}이 나왔습니다 — 업데이트하면 플레이할 수 있습니다.",
      hintUnknown:
        "게임 업데이트가 나왔습니다 — 업데이트하면 플레이할 수 있습니다.",
      patchShipped: "게임 업데이트가 나왔습니다 — 플레이 전에 업데이트하세요.",
      launching: "Spellbreak를 실행하는 중…",
    },
    events: {
      title: "진행 중인 이벤트",
      live: "진행 중",
      interested: "{count}명 관심",
      interested_other: "{count}명 관심",
      inMinutes: "{when} ({minutes}분 후)",
      inHours: "{when} ({hours}시간 후)",
    },
    news: {
      title: "새로운 소식",
      empty: "지금은 새로운 소식이 없습니다.",
    },
    stages: {
      downloadBase: "게임 내려받는 중",
      extractBase: "게임 푸는 중",
      downloadPatch: "업데이트 내려받는 중",
      extractPatch: "업데이트 설치 중",
      installMods: "모드 설치 중",
      downloadPlaytest: "플레이테스트 빌드 내려받는 중",
      extractPlaytest: "플레이테스트 빌드 설치 중",
      done: "완료",
    },
  },

  game: {
    title: "게임",
    version: "(v{version})",
    locate: "설치 위치 찾기",
    checkUpdates: "게임 업데이트 확인",
    checking: "확인 중…",
    download: "게임 내려받기…",
    location: "설치 위치",
    locationPlaceholder: "설정되지 않음",
    browse: "찾아보기…",
    save: "저장",
    noFolder:
      "게임 폴더가 설정되지 않았습니다 — 찾기나 게임 내려받기를 사용하세요.",
    pickFolder: "Spellbreak 폴더를 선택하세요",
    pickDestination: "Spellbreak를 설치할 위치를 선택하세요 (약 25 GB 필요)",
    folderSet: "게임 폴더를 설정했습니다: {path}",
    folderUpdated: "게임 폴더를 업데이트했습니다",
    updateAvailable:
      "게임 업데이트가 있습니다 (v{version}) — 홈에서 실행하세요.",
    upToDate: "게임이 최신 상태입니다",
    unreachable:
      "업데이트 서버에 연결하지 못했습니다. 설정의 CDN 주소를 확인하세요.",
    downloading: "설치 중: 용량이 큰 내려받기입니다. 런처를 켜 두세요.",
    downloaded: "게임을 {path}에 설치했습니다",
    downloadFailed: "설치에 실패했습니다: {detail}",
    alreadyCurrent: "이미 최신입니다 (v{version})",
    provisioning: "업데이트와 모드를 설치하는 중…",
    provisioned: "설치 준비 완료 (v{version})",
    provisionedUnknown: "설치 준비 완료",
    provisionFailed: "설치를 업데이트하지 못했습니다: {detail}",
    updated: "게임을 v{version}으로 업데이트했습니다",
    updatedUnknown: "게임을 업데이트했습니다",
    updateFailed: "업데이트에 실패했습니다: {detail}",
  },

  mods: {
    title: "모드",
    verify: "검사",
    verifying: "검사 중…",
    update: "게임 업데이트",
    updating: "업데이트 중…",
    install: "모드 설치 / 업데이트",
    installing: "설치 중…",
    checkingFiles: "모드 파일을 확인하는 중…",
    installedBadge: "설치됨",
    missingBadge: "없음",
    ready: "모드가 설치되어 준비되었습니다.",
    absent: "모드가 설치되어 있지 않습니다.",
    partial: "일부 모드 파일이 없습니다.",
    noFolder:
      "게임 폴더를 먼저 설정하세요 — 위의 찾기나 내려받기를 사용하세요.",
    missingCount:
      "{total}개 중 {count}개 파일이 없습니다 — 모드 설치 / 업데이트를 실행하세요.",
    missingCount_other:
      "{total}개 중 {count}개 파일이 없습니다 — 모드 설치 / 업데이트를 실행하세요.",
    patched: "v{version}으로 업데이트했습니다",
    patchedUnknown: "패치를 업데이트했습니다",
    installDone: "모드를 설치했습니다",
    installFailed: "설치에 실패했습니다",
  },

  errors: {
    noGameFolder: "게임 폴더를 먼저 설정하세요 (설정).",
    notSpellbreakInstall:
      "이 폴더는 Spellbreak 설치 폴더로 보이지 않습니다 (g3/Binaries/Win64가 없습니다).",
    paksNotFound: "Paks 폴더를 찾을 수 없습니다: {path}",
    unknownVariant: "알 수 없는 버전: {variant}",
    variantPakMissing:
      "{pak}이(가) Paks 폴더에 없습니다: 먼저 모드 설치 / 업데이트를 실행하세요.",
    playtestPakMissing:
      "{pak}이(가) 설치되어 있지 않습니다: 먼저 Playtest 빌드를 활성화해 내려받으세요.",
    noGameBinary:
      "{dir}에서 게임 실행 파일을 찾지 못했습니다 (찾은 이름: {names})",

    modArchiveTooSmall:
      "내려받은 mod.zip이 수상할 만큼 작습니다: CDN이 오류 페이지를 반환했을 수 있습니다.",
    launcherArchiveTooSmall:
      "내려받은 런처가 수상할 만큼 작습니다: CDN이 오류 페이지를 반환했을 수 있습니다.",
    playtestArchiveEmpty: "플레이테스트 아카이브에 .pak 파일이 없었습니다.",
    runtimeMissingUmu: "런타임 아카이브 안에서 umu-run을 찾지 못했습니다.",
    rangeRequestsUnsupported: "서버가 range 요청을 더 이상 받지 않습니다.",
    downloadStalled: "내려받기가 멈췄습니다 (범위 {range}, {remaining} 남음).",
    launcherUpdateDisabledInDev:
      "개발 빌드에서는 런처 자동 업데이트가 꺼져 있습니다 (EF_LAUNCHER_UPDATE=1을 설정하세요).",
    extractionIncomplete:
      "압축 풀기가 끝나지 않았습니다: {expected}개 중 {written}개 파일을 썼습니다. 내려받기가 손상되었을 가능성이 큽니다 — 설치 폴더를 지우고 다시 내려받으세요.",
    archiveMissingGameFolder:
      "압축을 푼 파일에 g3 폴더가 없습니다: 예상과 다른 아카이브 구조입니다.",
    runtimeArchiveCorrupt: "런타임 아카이브가 손상되었거나 불완전합니다.",
    runtimeNeedsPython:
      "게임 런타임을 찾지 못했고 python3도 없습니다 (umu / Proton에 필요합니다). 패키지 관리자로 python3을 설치하거나 Wine을 설치한 뒤 다시 시도하세요.",
    launcherVersionUnreadable: "CDN에서 런처 버전을 읽지 못했습니다.",
    archiveTooLarge:
      "이 다운로드는 압축을 풀면 {size}로, {limit} 제한을 넘습니다 — 디스크를 채우는 대신 거부했습니다. 다시 시도하고, 계속되면 제보해 주세요.",

    notSignedIn: "로그인되어 있지 않습니다.",
    playersUrlNotConfigured: "플레이어 수 URL이 설정되지 않았습니다.",
    enterEmailAndPassword: "이메일과 비밀번호를 입력하세요.",
    signInNotConfigured: "로그인이 설정되지 않았습니다.",
    signInFailed: "로그인에 실패했습니다. 다시 시도하세요.",
    wrongCredentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
    emailUnverified:
      "먼저 이메일을 인증하세요. 인증 코드는 받은편지함에 있습니다.",
    rateLimited: "시도가 너무 많습니다. 몇 분 뒤에 다시 시도하세요.",
    accountSuspended: "이 계정은 정지되었습니다.",
    accountSuspendedPermanent: "이 계정은 영구 정지되었습니다.",
    accountSuspendedUntil:
      "이 계정은 정지되었습니다. 정지는 {ends}에 해제됩니다.",
    suspensionReason: "사유: {reason}",

    wrapperNotInstalled:
      "‘{wrapper}’이(가) 설치되어 있지 않습니다. 설정에서 다른 실행 래퍼를 선택하세요 (예: wine 또는 umu-run).",
    wrapperNotInstalledOnHost:
      "호스트에 ‘{wrapper}’이(가) 설치되어 있지 않습니다. 설정에서 다른 실행 래퍼를 선택하세요 (예: wine 또는 umu-run).",
    foreignWinePrefix:
      "{prefix}의 prefix는 다른 Wine이 만든 것이라, {wrapper}가 이를 영구히 변환합니다 (그 prefix를 쓰는 앱이 망가질 수 있습니다). 빈 폴더를 선택해 새 prefix를 만들거나, 칸을 비워 기본값을 쓰세요.",

    unsupportedLinkScheme: "http(s) 링크만 열 수 있습니다.",

    io: "파일 오류: {detail}",
    network: "네트워크 오류: {detail}",
    badArchive: "잘못된 아카이브: {detail}",
    badArchiveEntry: "아카이브 항목의 이름을 쓸 수 없습니다: {detail}",
    badJson: "읽을 수 없는 응답: {detail}",
    downloadFailed: "내려받기에 실패했습니다 ({url}): {detail}",
    modDownloadFailed: "모드 내려받기에 실패했습니다: {detail}",
    launchFailed: "실행에 실패했습니다 ({command}): {detail}",
    signInUnreachable: "로그인 서비스에 연결하지 못했습니다: {detail}",
    noAppDataDir: "사용할 수 있는 앱 데이터 폴더가 없습니다: {detail}",
    runtimeNotExecutable: "umu-run에 실행 권한을 주지 못했습니다: {detail}",
    patchVersionWriteFailed:
      "패치는 적용했지만 version.txt를 쓰지 못했습니다: {detail}",
    launcherStageFailed: "실행 중인 바이너리를 옮겨 두지 못했습니다: {detail}",
    launcherInstallFailed: "새 바이너리를 설치하지 못했습니다: {detail}",
    launcherRestartFailed:
      "업데이트는 했지만 런처를 다시 시작하지 못했습니다: {detail}",
    backgroundTaskFailed: "백그라운드 작업이 실패했습니다: {detail}",
    unknown: "문제가 발생했습니다 ({code}).",
  },
};
