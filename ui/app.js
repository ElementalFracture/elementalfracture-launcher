const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

/* External links - edit in one place. */
const LINKS = {
  discord: "https://dsc.gg/elefrac",
  donate: "https://patreon.com/elementalfracture",
  patchnotes: "https://docs.elefrac.com/patchnotes",
  x: "https://x.com/elefracture",
  twitch: "https://twitch.tv/elementalfracture",
  youtube: "https://youtube.com/@elementalfracture",
};

/* Shown when the patchnotes feed isn't reachable. */
const FALLBACK_NEWS = [
  {
    title: "Launcher 1.0",
    body: "The launcher has been rewritten from scratch: one app now handles installing, patching, tokens and launching, on Windows and Linux.",
    date: "18 Jul 2026",
    url: "https://docs.elefrac.com/patchnotes",
  },
];

let settings = null;
let status = null;

const $ = (id) => document.getElementById(id);

function toast(msg, isError = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = isError ? "error" : "";
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.hidden = true), isError ? 5000 : 2600);
}

function openLink(url) {
  invoke("open_url", { url }).catch((e) => toast(String(e), true));
}

/* ---------------- navigation ---------------- */

document.querySelectorAll(".nav-btn[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn[data-view]").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name)
  );
  $("view-" + name).classList.add("active");
  if (name === "mods") {
    refreshFiles();
    refreshVersions();
    renderModsView();
    refreshVersionFields();
  } else if (name === "settings") {
    refreshVersionFields();
  }
}

/* Mods & Install view: reflect the current game folder + token status. */
function renderModsGame() {
  const line = $("mods-game-line");
  if (!line) return;
  const p = settings.game_path?.trim();
  line.textContent = p ? "Game folder: " + p : "No game folder set - Locate or Download the game.";
}
function renderModsView() {
  renderModsGame();
  const line = $("mods-token-line");
  if (line) {
    line.textContent = accountRegistered()
      ? `Signed in as ${settings.username?.trim() || "you"}.`
      : "No token set yet.";
  }
}

/* ---------------- account (name click) ---------------- */

function accountRegistered() {
  return !!settings.auth_token?.trim();
}

/* Friend list: a dropdown anchored under the account pill (mirrors the
   in-game breakdown popover), not a modal. Data comes from the players
   sidecar's /friends endpoint (friend graph + live online/in-game status). */
let friendsData = null;

const FRIEND_ERRORS = {
  user_not_found: "No player with that username.",
  cannot_friend_self: "That's you!",
  invalid_token: "Set your account token first.",
  username_required: "Enter a username.",
  no_pending_request: "No pending request from them.",
};
const friendError = (code) => FRIEND_ERRORS[code] || "Friend server unavailable - try again.";
const statusText = (s) => (s === "in_game" ? "in game" : s === "online" ? "online" : "offline");

function renderAccountPopover() {
  const me = friendsData?.me?.username || settings.username?.trim() || "You";
  $("friend-name").textContent = me;
  $("friend-avatar").textContent = (me || "EF").slice(0, 2).toUpperCase();
  const myStatus = friendsData?.me?.status || "online";
  $("friend-self-status").textContent = statusText(myStatus);
  $("friend-self-dot").dataset.status = myStatus;
  renderFriendList();
}

function friendRow(name, status, actions) {
  const row = document.createElement("div");
  row.className = "friend-row";
  const dot = document.createElement("span");
  dot.className = "status-dot";
  if (status) dot.dataset.status = status;
  const meta = document.createElement("div");
  meta.className = "friend-row-meta";
  const nm = document.createElement("strong");
  nm.textContent = name;
  meta.append(nm);
  if (status) {
    const st = document.createElement("small");
    st.textContent = statusText(status);
    meta.append(st);
  }
  row.append(dot, meta);
  const btns = document.createElement("div");
  btns.className = "friend-row-actions";
  for (const a of actions) {
    const b = document.createElement("button");
    b.textContent = a.label;
    b.title = a.title || a.label;
    if (a.kind) b.className = a.kind;
    b.dataset.friendAction = a.action;
    b.dataset.friendName = name;
    btns.append(b);
  }
  row.append(btns);
  return row;
}

function renderFriendList() {
  const reqBox = $("friend-requests");
  const listBox = $("friend-list");
  reqBox.innerHTML = "";
  listBox.innerHTML = "";
  if (!friendsData) {
    const p = document.createElement("p");
    p.className = "friend-empty";
    p.textContent = "Loading…";
    listBox.append(p);
    return;
  }
  const incoming = friendsData.incoming || [];
  const outgoing = friendsData.outgoing || [];
  const friends = friendsData.friends || [];

  if (incoming.length) {
    const h = document.createElement("div");
    h.className = "friend-subhead";
    h.textContent = `Requests (${incoming.length})`;
    reqBox.append(h);
    for (const r of incoming) {
      reqBox.append(friendRow(r.username, null, [
        { label: "✓", title: "Accept", action: "accept", kind: "ok" },
        { label: "✕", title: "Decline", action: "remove", kind: "no" },
      ]));
    }
  }

  const h2 = document.createElement("div");
  h2.className = "friend-subhead";
  h2.textContent = `Friends (${friends.length})`;
  listBox.append(h2);
  if (!friends.length && !outgoing.length) {
    const p = document.createElement("p");
    p.className = "friend-empty";
    p.textContent = "No friends yet - add someone by their username above.";
    listBox.append(p);
  }
  // Sort in-game first, then online, then offline (server pre-sorts by name).
  const rank = (s) => (s === "in_game" ? 0 : s === "online" ? 1 : 2);
  for (const f of [...friends].sort((a, b) => rank(a.status) - rank(b.status))) {
    listBox.append(friendRow(f.username, f.status || "offline", [
      { label: "✕", title: "Remove friend", action: "remove", kind: "no" },
    ]));
  }
  for (const o of outgoing) {
    const row = friendRow(o.username, null, [
      { label: "✕", title: "Cancel request", action: "remove", kind: "no" },
    ]);
    const pend = document.createElement("small");
    pend.className = "friend-pending";
    pend.textContent = "requested";
    row.querySelector(".friend-row-meta").append(pend);
    listBox.append(row);
  }
}

async function refreshFriends() {
  if (!accountRegistered()) return;
  try {
    const r = await invoke("friends_list");
    if (r && r.ok) friendsData = r;
  } catch {
    /* server unreachable - keep last-known data */
  }
  if (!$("account-popover").hidden) renderAccountPopover();
}

async function friendAction(action, username) {
  const cmd = action === "accept" ? "friend_accept"
            : action === "add" ? "friend_add" : "friend_remove";
  try {
    const r = await invoke(cmd, { username });
    if (r && r.ok) {
      if (action === "add") {
        toast(
          r.state === "accepted" ? `You're now friends with ${r.username}.`
          : r.state === "exists" ? `Already sent - waiting on ${r.username}.`
          : `Friend request sent to ${r.username}.`
        );
      }
      await refreshFriends();
    } else {
      toast(friendError(r?.error), true);
    }
  } catch (e) {
    toast(String(e), true);
  }
}

async function addFriend() {
  const input = $("friend-add-input");
  const name = input.value.trim();
  if (!name) return;
  input.value = "";
  await friendAction("add", name);
}

/* Token entry stays a focused modal (it's a form). */
function openTokenModal() {
  $("account-popover").hidden = true;
  $("account-token-input").value = "";
  $("account-modal").hidden = false;
  $("account-token-input").focus();
}

function closeTokenModal() {
  $("account-modal").hidden = true;
}

$("pill-account").addEventListener("click", (e) => {
  e.stopPropagation();
  // No token yet → straight to token entry; otherwise toggle the friend list.
  if (!accountRegistered()) {
    openTokenModal();
    return;
  }
  const pop = $("account-popover");
  if (pop.hidden) {
    renderAccountPopover();
    pop.hidden = false;
    refreshFriends(); // pull fresh statuses while it's open
  } else {
    pop.hidden = true;
  }
});

/* Add-friend input + delegated accept/decline/remove buttons. */
$("friend-add-btn").addEventListener("click", addFriend);
$("friend-add-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addFriend();
});
$("account-popover").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-friend-action]");
  if (btn) friendAction(btn.dataset.friendAction, btn.dataset.friendName);
});

$("account-change-token").addEventListener("click", openTokenModal);
$("account-token-cancel").addEventListener("click", closeTokenModal);
$("account-link-discord").addEventListener("click", () => openLink(LINKS.discord));

$("account-modal").addEventListener("click", (e) => {
  if (e.target === $("account-modal")) closeTokenModal();
});

$("account-token-save").addEventListener("click", async () => {
  const token = $("account-token-input").value.trim();
  if (!token) {
    toast("Paste your token first.", true);
    return;
  }
  const btn = $("account-token-save");
  btn.disabled = true;
  try {
    const res = await invoke("apply_token", { token });
    settings = await invoke("get_settings");
    renderAccount();
    friendsData = null; // new identity - drop any previous account's friends
    refreshFriends();
    if (res.verified && res.username) {
      const badge = res.is_dev ? " (dev)" : res.is_staff ? " (staff)" : "";
      toast(`Welcome, ${res.username}${badge}! Token saved.`);
    } else {
      toast(res.warning ?? "Token saved.", true);
    }
    closeTokenModal();
  } catch (e) {
    toast(String(e), true);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- external links ---------------- */

$("btn-discord").addEventListener("click", () => openLink(LINKS.discord));
document.querySelectorAll(".img-btn[data-url]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const url = LINKS[btn.dataset.url];
    if (url) openLink(url);
  });
});

/* ---------------- hero art rotation ---------------- */

const HERO_ART = [
  "assets/art/art-1.jpg",
  "assets/art/art-2.jpg",
  "assets/art/art-3.jpg",
  "assets/art/art-5.jpg",
  "assets/art/art-6.jpg",
];

(function heroRotation() {
  const layers = [$("hero-bg-a"), $("hero-bg-b")];
  let index = Math.floor(Math.random() * HERO_ART.length);
  let front = 0;

  // preload so crossfades never pop in half-loaded
  for (const src of HERO_ART) new Image().src = src;

  function show(i) {
    const back = 1 - front;
    layers[back].style.backgroundImage = `url("${HERO_ART[i]}")`;
    layers[back].classList.add("visible");
    layers[front].classList.remove("visible");
    front = back;
  }

  show(index);
  setInterval(() => {
    index = (index + 1) % HERO_ART.length;
    show(index);
  }, 18_000);
})();

/* ---------------- greeting ---------------- */

function greeting() {
  const name = settings?.username?.trim() || "breaker";
  const h = new Date().getHours();
  let lines;
  if (h >= 22 || h < 5) {
    lines = [
      `Burning the midnight oil, ${name}?`,
      `The Hollow Lands never sleep, ${name}.`,
    ];
  } else if (h < 12) {
    lines = [
      `Good morning, ${name}!`,
      `Rise and cast, ${name}!`,
    ];
  } else if (h < 17) {
    lines = [
      `Good afternoon, ${name}!`,
      `Perfect weather for a Spellstorm, ${name}.`,
    ];
  } else {
    lines = [
      `Good evening, ${name}!`,
      `The storm rolls in at dusk, ${name}.`,
    ];
  }
  // Stable pick for the session so it doesn't flicker between refreshes.
  if (greeting._pick === undefined) greeting._pick = Math.floor(Math.random() * lines.length);
  return lines[greeting._pick % lines.length];
}

function accountRole() {
  if (settings.is_dev) return "Developer";
  if (settings.is_staff) return "Staff";
  return "";
}

function renderAccount() {
  const name = settings.username?.trim();
  $("account-name").textContent = name || "Guest";
  // Only staff/developers carry a subheading - everyone else (Guest included)
  // shows just their name.
  const role = accountRole();
  const sub = $("account-sub");
  sub.textContent = role;
  sub.hidden = !role;
  $("avatar").textContent = (name || "EF").slice(0, 2).toUpperCase();
  $("greet").textContent = greeting();
}

/* ---------------- status / home ---------------- */

async function refreshStatus() {
  try {
    status = await invoke("get_status");
  } catch (e) {
    console.error(e);
    return;
  }
  const dot = $("game-dot");
  const state = $("game-state");
  const hint = $("launch-hint");
  const installed = status.exe_present;

  $("play-block").hidden = !installed;
  $("install-block").hidden = installed;

  if (!status.game_path) {
    dot.className = "dot";
    state.textContent = "Not installed";
    $("install-msg").textContent =
      "No Spellbreak install configured. Locate an existing install or download the game.";
  } else if (!installed) {
    dot.className = "dot";
    state.textContent = "Not found";
    $("install-msg").textContent =
      "Spellbreak.exe was not found in the configured folder. Locate the right folder or re-download.";
  } else {
    dot.className = "dot ok";
    state.textContent = status.local_version ? `v${status.local_version}` : "Installed";
    hint.textContent = "";
  }

  document.querySelectorAll(".variant-pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.variant === status.variant);
  });
  applyVariantTheme(status.variant);
}

// Swap the hero text + colour theme by variant. Classic → warm tan (body.classic in CSS)
// with the original-Spellbreak wording; EF → the default purple/gold + community-server copy.
const HERO_TEXT = {
  ef:      { eyebrow: "Elemental Fracture", title: "The Hollow Lands still beckon, breaker",
             sub: "Community servers, restored battles, new balance. Spellbreak lives on." },
  classic: { eyebrow: "Spellbreak Classic",  title: "The Hollow Lands, as they were before.",
             sub: "Community servers, restored battles, the original balance. Spellbreak, preserved." },
};
let _variantApplied = null;
function applyVariantTheme(variant) {
  const classic = variant === "classic";
  const heroEls = ["hero-eyebrow", "hero-title", "hero-sub"].map($).filter(Boolean);
  const setText = () => {
    const t = HERO_TEXT[classic ? "classic" : "ef"];
    if (heroEls[0]) heroEls[0].textContent = t.eyebrow;
    if (heroEls[1]) heroEls[1].textContent = t.title;
    if (heroEls[2]) heroEls[2].textContent = t.sub;
  };
  // Same variant (incl. the 15 s status poll): nothing to do.
  if (_variantApplied === variant) return;
  const isChange = _variantApplied !== null; // false on first load → apply instantly
  _variantApplied = variant;
  if (!isChange) {
    document.body.classList.toggle("classic", classic);
    setText();
    return;
  }
  // A real EF ⇄ Classic toggle: only the content that changes eases over, at
  // the same 2.6 s as the hero-art crossfade. Colours transition via
  // body.theming; the hero copy fades out, swaps at the midpoint, fades in.
  document.body.classList.add("theming");
  void document.body.offsetWidth; // commit the slow transitions before recolouring
  document.body.classList.toggle("classic", classic);
  clearTimeout(applyVariantTheme._recolour);
  applyVariantTheme._recolour = setTimeout(
    () => document.body.classList.remove("theming"), 2600);

  heroEls.forEach((el) => el.classList.add("fading"));
  clearTimeout(applyVariantTheme._copy);
  applyVariantTheme._copy = setTimeout(() => {
    setText();
    requestAnimationFrame(() => heroEls.forEach((el) => el.classList.remove("fading")));
  }, 1300);
}

document.querySelectorAll(".variant-pill").forEach((pill) => {
  pill.addEventListener("click", async () => {
    try {
      await invoke("set_variant", { variant: pill.dataset.variant });
    } catch (e) {
      toast(String(e), true);
    }
    refreshStatus();
  });
});

/* Info popovers (the little "i" buttons): toggle the sibling .info-pop. Delegated
   so one handler covers the variant popover AND every settings-toggle popover.
   stopImmediatePropagation keeps the click-outside handler below from instantly
   re-hiding it; preventDefault stops a switch from flipping when the "i" sits
   inside its <label>. */
document.addEventListener("click", (e) => {
  const closest = (s) => (e.target.closest ? e.target.closest(s) : null);
  // A click inside an open popover must not flip a switch whose <label> contains it.
  if (closest(".info-pop")) { e.preventDefault(); return; }
  const btn = closest(".info-btn");
  if (!btn) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const pop = btn.parentElement && btn.parentElement.querySelector(".info-pop");
  const show = pop && pop.hidden;
  document.querySelectorAll(".info-pop").forEach((p) => (p.hidden = true));
  if (pop) pop.hidden = !show;
});

$("btn-launch").addEventListener("click", async () => {
  try {
    await invoke("launch_game");
    toast("Launching Spellbreak…");
    // Opt-in (Settings → Launcher): close the launcher once the game is starting.
    // Small delay so the toast shows and the process is spawned first.
    if (settings.close_on_launch) {
      setTimeout(() => invoke("quit_launcher").catch(() => {}), 1200);
    }
  } catch (e) {
    toast(String(e), true);
  }
});

/* ---------------- About ---------------- */
$("btn-about").addEventListener("click", async () => {
  let ver = launcherInfo?.current;
  if (!ver) {
    try { ver = (await invoke("get_launcher_update"))?.current; } catch {}
  }
  $("about-version").textContent = ver ? `v${ver}` : "";
  $("about-modal").hidden = false;
});
$("btn-about-close").addEventListener("click", () => { $("about-modal").hidden = true; });

/* ---------------- game install / download ---------------- */

/* Bring a freshly-pointed-at install current: balance patch + mods, then
   the version bump (all in update_patch). Skipped when the install already
   matches the CDN version - such installs were provisioned by this same
   pipeline, mods included. */
async function provisionInstall(report = toast) {
  try {
    const v = await invoke("get_versions");
    if (v?.local && v?.remote && v.local === v.remote) {
      report(`Already up to date (v${v.local})`);
      return true;
    }
  } catch {}
  report("Installing updates & mods…");
  try {
    const ver = await invoke("update_patch");
    report(ver && ver !== "unknown" ? `Install ready (v${ver})` : "Install ready");
    return true;
  } catch (e) {
    report("Couldn't update the install: " + e, true);
    return false;
  } finally {
    refreshStatus();
  }
}

async function locateGame() {
  let dir = await invoke("auto_find_game");
  if (!dir) {
    toast("Nothing found in the usual places, pick the folder yourself.");
    dir = await invoke("pick_game_dir", { title: "Select your Spellbreak folder" });
  }
  if (!dir) return;
  settings.game_path = dir;
  await invoke("save_settings", { settings });
  fillSettingsForm();
  toast("Game folder set: " + dir);
  await refreshStatus();
  await provisionInstall();
  renderModsGame();
}
$("btn-locate").addEventListener("click", locateGame);
$("btn-mods-locate")?.addEventListener("click", locateGame);

listen("install-progress", (ev) => {
  const p = ev.payload;
  const stages = {
    "download-base": "Downloading game",
    "extract-base": "Extracting game",
    "download-patch": "Downloading update",
    "extract-patch": "Installing update",
    "install-mods": "Installing mods",
    "done": "Done",
  };
  $("progress").hidden = false;
  $("progress-stage").textContent = stages[p.stage] ?? p.stage;
  $("progress-msg").textContent = p.message ?? "";
  $("progress-fill").style.width = `${Math.max(0, Math.min(100, p.percent)).toFixed(1)}%`;
  if (p.stage === "done") {
    clearTimeout(listen._hideTimer);
    listen._hideTimer = setTimeout(() => ($("progress").hidden = true), 2500);
  }
});

/* Startup update check: if the install disagrees with the CDN version,
   pull the patch automatically and bump version.txt once it matches. */
/* Game update is no longer applied silently on boot - instead we surface a
   top-right "Game Update Available" popup the player clicks to apply (see
   showGameUpdatePop / the #game-update-pop handler). */
async function checkGameUpdate() {
  let v;
  try {
    v = await invoke("get_versions");
  } catch {
    return false;
  }
  const outdated = !!(v?.remote && status?.exe_present && v.local !== v.remote);
  if (outdated) showGameUpdatePop(v.remote);
  return outdated;
}

async function downloadGame() {
  const dest = await invoke("pick_game_dir", {
    title: "Choose where to install Spellbreak (approx. 25 GB needed)",
  });
  if (!dest) return;
  const setMsg = (t) => { for (const id of ["install-msg", "mods-game-line"]) { const el = $(id); if (el) el.textContent = t; } };
  const dis = (v) => { for (const id of ["btn-download-game", "btn-locate", "btn-mods-download", "btn-mods-locate"]) { const el = $(id); if (el) el.disabled = v; } };
  dis(true);
  setMsg("Installing: this is a big download, leave the launcher open.");
  try {
    const root = await invoke("download_game", { dest });
    toast("Game installed to " + root);
    settings = await invoke("get_settings");
    fillSettingsForm();
  } catch (e) {
    toast(String(e), true);
    setMsg("Install failed: " + e);
  } finally {
    dis(false);
    refreshStatus();
    renderModsGame();
  }
}
$("btn-download-game").addEventListener("click", downloadGame);
$("btn-mods-download")?.addEventListener("click", downloadGame);

/* Auth token in the Mods & Install view - two-step (enter twice to confirm). */
$("btn-mods-token-save")?.addEventListener("click", async () => {
  const token = $("mods-token").value.trim();
  const confirm = $("mods-token-confirm").value.trim();
  const line = $("mods-token-line");
  if (!token) { toast("Enter your token.", true); return; }
  if (token !== confirm) {
    toast("Tokens don't match.", true);
    if (line) line.textContent = "The two tokens don't match - re-enter to confirm.";
    return;
  }
  const btn = $("btn-mods-token-save");
  btn.disabled = true;
  try {
    const res = await invoke("apply_token", { token });
    settings = await invoke("get_settings");
    renderAccount();
    friendsData = null; // new identity - drop any previous account's friends
    refreshFriends();
    if (res.verified && res.username) {
      const badge = res.is_dev ? " (dev)" : res.is_staff ? " (staff)" : "";
      toast(`Welcome, ${res.username}${badge}! Token saved.`);
      if (line) line.textContent = `Signed in as ${res.username}${badge}.`;
    } else {
      toast(res.warning ?? "Token saved.", true);
      if (line) line.textContent = res.warning ?? "Token saved (could not verify).";
    }
    $("mods-token").value = "";
    $("mods-token-confirm").value = "";
  } catch (e) {
    toast(String(e), true);
    if (line) line.textContent = String(e);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- players / news ---------------- */

let playersData = null;

async function refreshPlayers() {
  try {
    playersData = await invoke("get_players");
  } catch {
    playersData = null;
  }
  const inGame = Number.isFinite(playersData?.online) ? playersData.online : null;
  const connected = Number.isFinite(playersData?.connected) ? playersData.connected : null;
  $("online-count").textContent = connected ?? inGame ?? "–";
  $("ingame-count").textContent = inGame ?? "–";
  if (!$("ingame-popover").hidden) renderIngamePopover();
}

/* ---- in-game breakdown by mode ---- */

const MODE_LABELS = [
  [/solo/i, "Solos"],
  [/duo/i, "Duos"],
  [/squad/i, "Squads"],
  [/arena|tdm|capture/i, "Arena/TDM"],
];

function modeLabel(srv) {
  const s = srv.display_name || srv.name || "";
  for (const [re, label] of MODE_LABELS) if (re.test(s)) return label;
  return s || "Other";
}

// Elemental Fracture (EF balance) vs Classic (vanilla). Classic servers are the manager's
// dynamic vanilla groups: container name vsolo/vduos/… and display "Classic <Mode> N".
const VARIANTS = [["ef", "Elemental Fracture"], ["classic", "Classic"]];
function variantOf(srv) {
  return /^v(solo|duo|squad|arena)/i.test(srv.name || "") ||
         /^classic\b/i.test(srv.display_name || "")
    ? "classic" : "ef";
}

function renderIngamePopover() {
  const pop = $("ingame-popover");
  pop.innerHTML = "";
  const servers = playersData?.servers ?? [];
  const newModes = () => {
    const m = new Map(); // label → {count, names, byRegion: Map<region, count>}
    for (const [, label] of MODE_LABELS) m.set(label, { count: 0, names: [], byRegion: new Map() });
    return m;
  };
  const byVariant = { ef: newModes(), classic: newModes() };
  const regions = new Set();
  for (const srv of servers) {
    const modes = byVariant[variantOf(srv)];
    const label = modeLabel(srv);
    if (!modes.has(label)) modes.set(label, { count: 0, names: [], byRegion: new Map() });
    const m = modes.get(label);
    const n = srv.players ?? 0;
    m.count += n;
    if (Array.isArray(srv.names)) m.names.push(...srv.names);
    const region = srv.region || "";
    if (region) {
      regions.add(region);
      m.byRegion.set(region, (m.byRegion.get(region) ?? 0) + n);
    }
  }
  // Only show the NA/EU split once a second region is actually reporting, so the
  // NA-only view stays clean until the peer merge is live.
  const multiRegion = regions.size > 1;
  const regionRank = (r) => (r === "NA" ? 0 : r === "EU" ? 1 : 2);
  const regionSplit = (m) =>
    [...m.byRegion.entries()]
      .filter(([, c]) => c > 0)
      .sort((a, b) => regionRank(a[0]) - regionRank(b[0]))
      .map(([r, c]) => `${r} ${c}`)
      .join(" · ");

  // One [Variant] heading followed by its four mode rows (idle = 0), so the shape stays
  // stable. The per-mode roster only shows for populated modes to keep the two-section
  // list compact.
  for (const [vkey, vlabel] of VARIANTS) {
    const head = document.createElement("div");
    head.className = "variant-head";
    head.textContent = vlabel;
    pop.append(head);
    for (const [label, m] of byVariant[vkey]) {
      const row = document.createElement("div");
      row.className = "mode-row";
      const name = document.createElement("span");
      name.textContent = label;
      const count = document.createElement("span");
      count.className = "mode-count";
      const split = multiRegion && m.count > 0 ? regionSplit(m) : "";
      count.textContent = split ? `${m.count}  (${split})` : String(m.count);
      row.append(name, count);
      pop.append(row);
      if (m.count > 0) {
        const names = document.createElement("div");
        names.className = "mode-names";
        names.textContent = m.names.length ? m.names.join(", ") : `${m.count} player(s)`;
        pop.append(names);
      }
    }
  }
  if (servers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mode-names";
    empty.textContent = "Server data unavailable.";
    pop.append(empty);
  }
}

$("pill-ingame").addEventListener("click", (e) => {
  e.stopPropagation();
  const pop = $("ingame-popover");
  if (pop.hidden) {
    renderIngamePopover();
    pop.hidden = false;
    refreshPlayers(); // pull fresh names while it's open
  } else {
    pop.hidden = true;
  }
});

document.addEventListener("click", (e) => {
  const pop = $("ingame-popover");
  if (!pop.hidden && !pop.contains(e.target)) pop.hidden = true;
  const apop = $("account-popover");
  if (!apop.hidden && !apop.contains(e.target)) apop.hidden = true;
  document.querySelectorAll(".info-pop").forEach((p) => {
    if (!p.hidden && !p.contains(e.target)) p.hidden = true;
  });
});

async function refreshNews() {
  let items;
  try {
    items = await invoke("get_news");
  } catch {
    /* feed unreachable */
  }
  if (!Array.isArray(items) || items.length === 0) items = FALLBACK_NEWS;

  const wrap = $("news-cards");
  wrap.innerHTML = "";
  for (const item of items.slice(0, 6)) {
    const card = document.createElement("div");
    card.className = "card";
    const h = document.createElement("h4");
    h.textContent = item.title ?? "";
    const p = document.createElement("p");
    p.textContent = item.body ?? "";
    const d = document.createElement("span");
    d.className = "date";
    d.textContent = item.date ?? "";
    card.append(h, p, d);
    if (item.url) card.addEventListener("click", () => openLink(item.url));
    wrap.appendChild(card);
  }
}

/* ---------------- live events ---------------- */

function formatEventTime(ev) {
  if (ev.status === "ACTIVE") return "LIVE NOW";
  if (!ev.start) return "";
  const d = new Date(ev.start);
  const diffMs = d - Date.now();
  const when = d.toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
  if (diffMs > 0 && diffMs < 36e5) return `${when} (in ${Math.max(1, Math.round(diffMs / 6e4))} min)`;
  if (diffMs > 0 && diffMs < 864e5) return `${when} (in ${Math.round(diffMs / 36e5)} h)`;
  return when;
}

async function refreshEvents() {
  let events;
  try {
    const r = await invoke("get_events");
    events = r.events;
  } catch {
    /* sidecar without events support / unreachable */
  }
  const head = $("events-head");
  const wrap = $("event-cards");
  if (!Array.isArray(events) || events.length === 0) {
    head.hidden = true;
    wrap.hidden = true;
    return;
  }
  head.hidden = false;
  wrap.hidden = false;
  wrap.innerHTML = "";
  for (const ev of events.slice(0, 4)) {
    const card = document.createElement("div");
    card.className = "card event-card";
    const h = document.createElement("h4");
    h.textContent = ev.name ?? "";
    const time = document.createElement("span");
    time.className = "event-time" + (ev.status === "ACTIVE" ? " live" : "");
    time.textContent = formatEventTime(ev);
    const p = document.createElement("p");
    p.textContent = ev.description ?? "";
    const meta = document.createElement("span");
    meta.className = "date";
    meta.textContent = [ev.location, ev.interested ? `${ev.interested} interested` : ""]
      .filter(Boolean)
      .join("  ·  ");
    card.append(h, time, p, meta);
    if (ev.url) card.addEventListener("click", () => openLink(ev.url));
    wrap.appendChild(card);
  }
}

/* ---------------- mods view ---------------- */

/* Mods ship pre-installed, so the per-DLL list is just noise: collapse the
   verify result to a single installed / not-installed status. */
async function refreshFiles() {
  let files;
  try {
    files = await invoke("verify_install");
  } catch (e) {
    toast(String(e), true);
    return;
  }
  const total = files.length;
  const missing = files.filter((f) => !f.present).length;
  const statusEl = $("mods-status");
  const badge = $("mods-status-badge");
  const text = $("mods-status-text");
  const summary = $("install-summary");

  if (!status?.game_path) {
    statusEl.hidden = true;
    summary.textContent = "Set the game folder first (Home → Locate, or Settings).";
    return;
  }
  statusEl.hidden = false;
  if (missing === 0) {
    badge.className = "badge ok";
    badge.textContent = "INSTALLED";
    text.textContent = "Mods are installed and ready.";
    summary.textContent = "";
  } else {
    badge.className = "badge missing";
    badge.textContent = "MISSING";
    text.textContent = missing === total ? "Mods are not installed." : "Some mod files are missing.";
    summary.textContent = `${missing} of ${total} file(s) missing - run Install / Update mods.`;
  }
}

async function refreshVersions() {
  try {
    const v = await invoke("get_versions");
    const line = [];
    if (v.local) line.push(`Game: v${v.local}`);
    if (v.remote) line.push(`Latest: v${v.remote}`);
    if (launcherInfo?.current) line.push(`Launcher: v${launcherInfo.current}`);
    $("version-line").textContent = line.join("   ·   ");
    const outdated = v.local && v.remote && v.local !== v.remote;
    $("btn-update").hidden = !outdated;
    if (outdated) toastOnce(`Update available: v${v.remote}`);
  } catch {
    $("version-line").textContent = "";
  }
}

function toastOnce(msg) {
  if (toastOnce._done) return;
  toastOnce._done = true;
  toast(msg);
}

$("btn-verify").addEventListener("click", refreshFiles);

$("btn-update").addEventListener("click", async () => {
  const btn = $("btn-update");
  btn.disabled = true;
  btn.textContent = "Updating…";
  try {
    const v = await invoke("update_patch");
    toast(v && v !== "unknown" ? `Updated to v${v}` : "Patch updated");
  } catch (e) {
    toast(String(e), true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Update game";
    refreshVersions();
    refreshStatus();
  }
});

$("btn-install").addEventListener("click", async () => {
  const btn = $("btn-install");
  btn.disabled = true;
  btn.textContent = "Installing…";
  const log = $("install-log");
  try {
    const lines = await invoke("install_mods");
    log.hidden = false;
    log.textContent = lines.join("\n");
    toast("Mods installed");
  } catch (e) {
    log.hidden = false;
    log.textContent = String(e);
    toast("Install failed", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Install / Update mods";
    refreshFiles();
  }
});

/* ---------------- first-boot wizard ---------------- */

const GUIDE_URL = "https://docs.elefrac.com/docs/intro"; // TODO: swap when the proper domain is up

function wizardShow(step) {
  document.querySelectorAll(".wizard-step").forEach((s) => (s.hidden = s.dataset.step !== step));
}

function startWizard() {
  $("wizard").hidden = false;
  wizardShow("welcome");
}

async function finishWizard() {
  settings.onboarded = true;
  try {
    await invoke("save_settings", { settings });
  } catch {}
  $("wizard").hidden = true;
  fillSettingsForm();
  renderAccount();
  refreshStatus();
}

$("wz-next-welcome").addEventListener("click", () => wizardShow("game"));

$("wz-game-yes").addEventListener("click", async () => {
  const result = $("wz-game-result");
  result.textContent = "Looking for an existing install…";
  let dir = await invoke("auto_find_game");
  if (!dir) {
    dir = await invoke("pick_game_dir", { title: "Select your Spellbreak folder (contains g3 and Engine)" });
  }
  if (!dir) {
    result.textContent = "No folder selected, you can set it any time in Settings.";
    return;
  }
  settings.game_path = dir;
  try {
    await invoke("save_settings", { settings });
    result.textContent = "Hooked: " + dir + ", installing updates & mods…";
    await provisionInstall((msg, isError) => {
      result.textContent = isError ? msg : "Hooked: " + dir + ", " + msg.toLowerCase();
    });
    setTimeout(() => wizardShow("done"), 900);
  } catch (e) {
    result.textContent = String(e);
  }
});

$("wz-game-no").addEventListener("click", () => wizardShow("token"));

$("wz-link-discord").addEventListener("click", () => openLink(LINKS.discord));
$("wz-link-guide").addEventListener("click", () => openLink(GUIDE_URL));

$("wz-token-save").addEventListener("click", async () => {
  const token = $("wz-token").value.trim();
  if (!token) {
    wizardShow("done");
    return;
  }
  const btn = $("wz-token-save");
  btn.disabled = true;
  try {
    const res = await invoke("apply_token", { token });
    settings = await invoke("get_settings");
    if (res.verified && res.username) {
      $("wz-done-title").textContent = `You're all set, ${res.username}!`;
    } else if (res.warning) {
      toast(res.warning, true);
    }
    $("wz-token").value = "";
    wizardShow("done");
  } catch (e) {
    toast(String(e), true);
  } finally {
    btn.disabled = false;
  }
});

$("wz-token-skip").addEventListener("click", () => wizardShow("done"));

$("wz-finish").addEventListener("click", finishWizard);

/* ---------------- settings view ---------------- */

function fillSettingsForm() {
  $("set-game-path").value = settings.game_path ?? "";
  $("toggle-minimize-close").checked = !!settings.minimize_on_close;
  $("toggle-close-on-launch").checked = !!settings.close_on_launch;
  $("set-launch-cmd").value = settings.launch_command ?? "";
  $("set-wine-prefix").value = settings.wine_prefix ?? "";
  $("set-cdn-base").value = settings.cdn_base ?? "";
  $("set-auth-url").value = settings.auth_url ?? "";
  $("set-players-url").value = settings.players_url ?? "";
  // Advanced is always collapsed on (re)load - it's opt-in per session.
  $("toggle-advanced").checked = false;
  $("advanced-panel").hidden = true;
  syncWrapperUI();
}

/* ---- launch wrapper picker (Linux): offer what's installed ---- */

let wrappers = [];

async function loadWrappers() {
  try {
    wrappers = await invoke("detect_wrappers");
  } catch {
    wrappers = [];
  }
  const sel = $("set-launch-select");
  sel.innerHTML = "";
  for (const w of wrappers) {
    const o = document.createElement("option");
    o.value = w.command;
    o.textContent = w.label;
    sel.append(o);
  }
  const custom = document.createElement("option");
  custom.value = "__custom__";
  custom.textContent = wrappers.length
    ? "Custom…"
    : "Custom… (no wrapper detected; install Wine or umu)";
  sel.append(custom);
  syncWrapperUI();
}

function syncWrapperUI() {
  const sel = $("set-launch-select");
  if (!sel.options.length) return; // wrappers not loaded yet
  const input = $("set-launch-cmd");
  const cur = (settings?.launch_command ?? "").trim();
  if (cur && wrappers.some((w) => w.command === cur)) {
    sel.value = cur;
    input.hidden = true;
  } else if (wrappers.length) {
    // Nothing saved, or the saved wrapper isn't installed here (e.g. the
    // old "wine" default on a umu-only system): suggest what exists.
    sel.value = wrappers[0].command;
    input.hidden = true;
  } else {
    sel.value = "__custom__";
    input.hidden = false;
    input.value = cur;
  }
}

$("set-launch-select").addEventListener("change", () => {
  const custom = $("set-launch-select").value === "__custom__";
  $("set-launch-cmd").hidden = !custom;
  if (custom) $("set-launch-cmd").focus();
});

/* ---- advanced options: gated behind a warning (Continue / Back) ---- */

$("toggle-advanced").addEventListener("change", () => {
  if ($("toggle-advanced").checked) {
    // Keep the switch visually on while the warning is up; Back reverts it.
    $("advanced-warn-modal").hidden = false;
  } else {
    $("advanced-panel").hidden = true;
  }
});

$("advanced-warn-continue").addEventListener("click", () => {
  $("advanced-panel").hidden = false;
  $("advanced-warn-modal").hidden = true;
});

$("advanced-warn-back").addEventListener("click", () => {
  $("toggle-advanced").checked = false;
  $("advanced-panel").hidden = true;
  $("advanced-warn-modal").hidden = true;
});

function selectedWrapper() {
  if (navigator.platform.startsWith("Win")) return settings?.launch_command ?? "";
  const sel = $("set-launch-select");
  if (!sel.options.length) return $("set-launch-cmd").value.trim();
  return sel.value === "__custom__" ? $("set-launch-cmd").value.trim() : sel.value;
}

$("btn-browse-prefix").addEventListener("click", async () => {
  const dir = await invoke("pick_game_dir", { title: "Select a Wine prefix folder" });
  if (dir) $("set-wine-prefix").value = dir;
});

$("btn-save-settings").addEventListener("click", async () => {
  const prevGamePath = settings?.game_path ?? "";
  settings = {
    ...settings,
    // game_path is set via the Game folder Browse button (and Mods & Install).
    minimize_on_close: $("toggle-minimize-close").checked,
    close_on_launch: $("toggle-close-on-launch").checked,
    launch_command: selectedWrapper(),
    wine_prefix: $("set-wine-prefix").value.trim(),
    cdn_base: $("set-cdn-base").value.trim(),
    auth_url: $("set-auth-url").value.trim(),
    players_url: $("set-players-url").value.trim(),
  };
  try {
    await invoke("save_settings", { settings });
    toast("Settings saved");
    await refreshStatus();
    refreshPlayers();
  } catch (e) {
    toast(String(e), true);
    return;
  }
  // A new game folder gets brought current like any fresh install.
  if (settings.game_path && settings.game_path !== prevGamePath && status?.exe_present) {
    await provisionInstall();
  }
});

/* Change the game folder from Settings → Launcher. */
$("btn-browse-game").addEventListener("click", async () => {
  try {
    const dir = await invoke("pick_game_dir", { title: "Select your Spellbreak folder" });
    if (!dir) return;
    settings.game_path = dir;
    $("set-game-path").value = dir;
    await invoke("save_settings", { settings });
    await refreshStatus();
    if (status?.exe_present) await provisionInstall();
    toast("Game folder updated");
  } catch (e) {
    toast(String(e), true);
  }
});

/* ---------------- update popups (top-right corner) ---------------- */

let launcherInfo = null;
let gameUpdateVer = null;

function showLauncherUpdatePop() {
  const sub = $("launcher-update-sub");
  if (sub) {
    sub.textContent = launcherInfo?.remote
      ? `v${launcherInfo.remote} ready · click to update`
      : "Click to update";
  }
  $("launcher-update-pop").hidden = false;
}

function showGameUpdatePop(remote) {
  gameUpdateVer = remote || null;
  const sub = $("game-update-sub");
  if (sub) sub.textContent = remote ? `v${remote} ready · click to update` : "Click to update";
  $("game-update-pop").hidden = false;
}

/* Startup check. Honors the backend's `update` flag, which stays quiet
   when the last self-update already pulled this CDN version (guards
   against a re-prompt loop if the shipped binary reports an older
   compiled-in version). */
async function checkLauncherUpdate() {
  try {
    launcherInfo = await invoke("get_launcher_update");
  } catch {
    return;
  }
  if (launcherInfo?.update) showLauncherUpdatePop();
}

/* ---- launcher-update popup: click = install, × = dismiss ---- */
$("launcher-update-dismiss").addEventListener("click", (e) => {
  e.stopPropagation();
  $("launcher-update-pop").hidden = true;
});
$("launcher-update-pop").addEventListener("click", async () => {
  const pop = $("launcher-update-pop");
  if (pop.classList.contains("busy")) return;
  pop.classList.add("busy");
  $("launcher-update-sub").textContent = "Installing…";
  try {
    // On success the backend restarts the launcher; this call never resolves.
    await invoke("update_launcher");
  } catch (e) {
    toast(String(e), true);
    pop.classList.remove("busy");
    $("launcher-update-sub").textContent = "Click to update";
  }
});

/* ---- game-update popup: click = update, × = dismiss ---- */
$("game-update-dismiss").addEventListener("click", (e) => {
  e.stopPropagation();
  $("game-update-pop").hidden = true;
});
$("game-update-pop").addEventListener("click", async () => {
  const pop = $("game-update-pop");
  if (pop.classList.contains("busy")) return;
  pop.classList.add("busy");
  $("game-update-sub").textContent = "Updating…";
  $("btn-launch").disabled = true;
  try {
    const version = await invoke("update_patch");
    toast(version && version !== "unknown" ? `Game updated to v${version}` : "Game updated");
    pop.hidden = true;
  } catch (e) {
    toast("Update failed: " + e, true);
    $("game-update-sub").textContent = "Click to update";
  } finally {
    pop.classList.remove("busy");
    $("btn-launch").disabled = false;
    refreshStatus();
    refreshVersions();
  }
});

/* The Settings "Versions" fields mirror the CDN config.ini version tracks,
   falling back to what's installed when the CDN is unreachable. */
async function refreshVersionFields() {
  try {
    const v = await invoke("get_versions");
    $("set-game-version").value =
      v.remote ? `v${v.remote}` : v.local ? `v${v.local} (installed)` : "";
  } catch {}
  if (launcherInfo?.remote) {
    const cur = launcherInfo.current;
    $("set-launcher-version").value =
      `v${launcherInfo.remote}` +
      (cur && cur !== launcherInfo.remote ? ` (installed: v${cur})` : "");
  } else if (launcherInfo?.current) {
    $("set-launcher-version").value = `v${launcherInfo.current} (installed)`;
  }
}

/* Manual game-update check (Game Settings). Compares the installed game
   version to the CDN and, if behind, raises the "Game Update Available"
   popup rather than updating on the spot. */
$("btn-check-game-updates").addEventListener("click", async () => {
  const btn = $("btn-check-game-updates");
  btn.disabled = true;
  btn.textContent = "Checking…";
  try {
    let v = null;
    try { v = await invoke("get_versions"); } catch {}
    await refreshVersionFields();
    if (!v?.remote) {
      toast("Couldn't reach the update server, check the CDN base in Advanced.", true);
    } else if (v.local && v.remote && v.local !== v.remote && status?.exe_present) {
      showGameUpdatePop(v.remote);
    } else {
      toast("Game is up to date");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Check for game updates";
  }
});

/* Manual launcher-update check (Launcher Settings). Compares directly (no
   marker guard); if the CDN reports a different launcher version, raises the
   "Launcher Update Available" popup. */
$("btn-check-launcher-updates").addEventListener("click", async () => {
  const btn = $("btn-check-launcher-updates");
  btn.disabled = true;
  btn.textContent = "Checking…";
  try {
    try { launcherInfo = await invoke("get_launcher_update"); } catch {}
    await refreshVersionFields();
    const outdated =
      !!(launcherInfo?.remote && launcherInfo.remote !== launcherInfo.current);
    if (outdated) {
      showLauncherUpdatePop();
    } else if (!launcherInfo?.remote) {
      toast("Couldn't reach the update server, check the CDN base in Advanced.", true);
    } else {
      toast("Launcher is up to date");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Check for launcher updates";
  }
});

/* Reset configuration: two-step confirm, then wipe settings and re-run
   the first-boot wizard as if the launcher were freshly installed. */
$("btn-reset-settings").addEventListener("click", async () => {
  const btn = $("btn-reset-settings");
  if (!btn.classList.contains("armed")) {
    btn.classList.add("armed");
    btn.textContent = "Click again to confirm reset";
    btn._disarm = setTimeout(() => {
      btn.classList.remove("armed");
      btn.textContent = "Reset configuration";
    }, 4000);
    return;
  }
  clearTimeout(btn._disarm);
  btn.classList.remove("armed");
  btn.textContent = "Reset configuration";
  try {
    settings = await invoke("reset_settings");
  } catch (e) {
    toast(String(e), true);
    return;
  }
  toast("Configuration reset");
  fillSettingsForm();
  renderAccount();
  refreshStatus();
  refreshPlayers();
  showView("home");
  startWizard();
});

/* ---------------- init ---------------- */

(async function init() {
  settings = await invoke("get_settings");
  // Update-first: before loading the rest of the launcher (on every version), check
  // for a newer launcher. If one is available the install modal comes up straight
  // away, so a stale build gets replaced before its UI even matters.
  await checkLauncherUpdate();
  if (navigator.platform.startsWith("Win")) {
    $("field-launch-cmd").style.display = "none";
    $("field-wine-prefix").style.display = "none";
  } else {
    loadWrappers();
  }
  fillSettingsForm();
  renderAccount();
  await refreshStatus();
  if (!settings.onboarded) startWizard();
  refreshNews();
  refreshPlayers();
  refreshEvents();
  checkGameUpdate();
  refreshVersionFields();
  refreshFriends();
  setInterval(refreshPlayers, 60_000);
  setInterval(refreshEvents, 300_000);
  setInterval(refreshStatus, 15_000);
  // Also the launcher presence heartbeat: polling /friends marks the user
  // "online" while the launcher is open (the sidecar bumps their presence).
  setInterval(refreshFriends, 60_000);
})();
