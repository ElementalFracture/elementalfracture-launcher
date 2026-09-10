/**
 * The CDN side of the wire, for exercising the launcher's updater locally.
 *
 * The download path in src-tauri/src/download.rs pulls five things off
 * `cdn_base`: the version file it compares against, the balance patch, the
 * playtest patch, the mod package, and (fresh installs only) the base game. Debug builds point at this
 * server by default (`cdn_base()` in settings.rs), so every one of them is
 * answered here from the `update` block in data.json and an update run happens
 * against bytes you control — dummy ones, which do land in the profile's
 * game_path.
 *
 *   {cdn}/launcher/config.ini   version tracks the badge + startup check read
 *   {cdn}/patch/latest.zip      the balance paks, extracted into g3/…/Paks
 *   {cdn}/patch/dev.zip         the playtest balance pak (Enable Playtest)
 *   {cdn}/patch/mod/mod.zip     the mod loader + DLLs
 *   {cdn}/game/elefracbase.zip  the base install (download_game)
 *   {cdn}/launcher/manifest.json (+.sig)  the signed hash list every zip is checked against
 *   {cdn}/launcher/manifest.pub           this server's throwaway public key (debug builds only)
 *
 * The launcher refuses any payload that isn't in a manifest signed by a key it
 * trusts (src-tauri/src/download/manifest.rs). A release build trusts only the
 * compiled-in release key, which this server does not have; a debug build also
 * trusts whatever `/launcher/manifest.pub` says, so the server mints an ed25519 pair on
 * start, hashes the assets it builds, and signs the list with it. The manifest
 * `version` defaults to the server's start time in seconds (the same clock the
 * real release tooling stamps), so it is always newer than the last one the
 * dev profile accepted; set `update.manifest_version` to drive the rollback
 * refusal on purpose.
 *
 * The point of the harness is the `stall` switch: the bug it was written for is
 * an updater that FREEZES mid-progress, which is what a connection that sends
 * its headers and then goes silent does to a client with no read timeout. Set
 * `update.stall` and the chosen asset streams partway, then hangs the socket
 * forever — the exact shape of the freeze. A launcher with the read-timeout fix
 * gives up after ~30s with a "download stalled" error instead of hanging.
 *
 * No dependencies, on purpose (see README): the zips are built here by hand as
 * store-only (uncompressed) archives, which is all `zip::ZipArchive` needs.
 */

import { createHash, generateKeyPairSync, sign } from "node:crypto";

/* ── CRC32 (store-only zips still carry a checksum per entry) ─────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Assemble a store-only ZIP from `[name, Buffer]` entries. Local header +
 * central directory + end-of-central-directory, the minimum a reader needs.
 */
export function storeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n >>> 0);
    return b;
  };
  const u32 = (n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n >>> 0);
    return b;
  };

  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed
      u16(0), // flags
      u16(0), // method: store
      u16(0),
      u16(0), // mod time / date
      u32(crc),
      u32(data.length), // compressed size
      u32(data.length), // uncompressed size
      u16(nameBuf.length),
      u16(0), // extra length
      nameBuf,
    ]);
    chunks.push(local, data);

    central.push(
      Buffer.concat([
        u32(0x02014b50), // central directory header signature
        u16(20), // version made by
        u16(20), // version needed
        u16(0), // flags
        u16(0), // method
        u16(0),
        u16(0), // time / date
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBuf.length),
        u16(0), // extra
        u16(0), // comment
        u16(0), // disk number start
        u16(0), // internal attrs
        u32(0), // external attrs
        u32(offset), // local header offset
        nameBuf,
      ])
    );
    offset += local.length + data.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.concat([
    u32(0x06054b50), // end of central directory signature
    u16(0),
    u16(0), // disk numbers
    u16(entries.length),
    u16(entries.length),
    u32(cd.length),
    u32(offset), // central directory offset
    u16(0), // comment length
  ]);
  return Buffer.concat([...chunks, cd, eocd]);
}

/* ── The assets, built from data.json's `update` block ────────────────────── */

/** Pad a payload to `bytes` so a zip can be pushed past the launcher's 64 MB
 *  segmented-download threshold (or the mod route's 1 KB "too small" guard). */
function filler(label, bytes) {
  const b = Buffer.alloc(Math.max(0, bytes));
  b.write(`ef-test-env ${label}\n`);
  return b;
}

function cfg(state) {
  return state.update ?? {};
}

/** The five assets, keyed by the path each is served at. Each is `{ type,
 *  bytes }` — the ini as text, the zips as store archives with dummy but
 *  structurally real contents so extraction on the happy path succeeds. */
export function asset(path, state) {
  const u = cfg(state);
  const sizeMb = Number(u.size_mb) || 0; // 0 → naturally small (sequential)
  const pad = (label) => filler(label, sizeMb * 1024 * 1024);

  switch (path) {
    case "/launcher/config.ini": {
      const launcher = u.launcher_version ?? "3.2.1";
      const game = u.game_version ?? "6.8.1";
      const ini =
        "; test-env remote config\n[Versions]\n" +
        `LauncherVersion=${launcher}\nGameVersion=${game}\n`;
      return { type: "text/plain", bytes: Buffer.from(ini, "utf8") };
    }
    case "/patch/latest.zip":
      // extract_flat drops these straight into g3/Content/Paks; the pak's
      // presence is what detect_variant reads as the "ef" balance.
      return {
        type: "application/zip",
        bytes: storeZip([
          ["ElefracBalance_P.pak", pad("balance pak")],
          ["ElefracBalance_P.sig", Buffer.from("sig")],
        ]),
      };
    case "/patch/dev.zip":
      // The playtest channel ("Enable Playtest" in the variant pill). The CDN
      // key kept its old `dev` name; install_playtest_build renames whatever
      // .pak/.sig it finds inside to ElefracTest_P.*, so the inner names being
      // different from the staged ones is the point, not an oversight.
      return {
        type: "application/zip",
        bytes: storeZip([
          ["ElefracPlaytest_P.pak", pad("playtest pak")],
          ["ElefracPlaytest_P.sig", Buffer.from("sig")],
        ]),
      };
    case "/patch/mod/mod.zip":
      // install_from_zip sends xinput1_3.dll to Win64 (the loader) and any
      // other DLL to Mods/dlls. Kept over 1 KB so the "suspiciously small"
      // guard reads it as a real package.
      return {
        type: "application/zip",
        bytes: storeZip([
          ["xinput1_3.dll", filler("loader", Math.max(2048, sizeMb * 1024 * 1024))],
          ["efmod.dll", Buffer.from("ef test mod dll")],
        ]),
      };
    case "/game/elefracbase.zip":
      // download_game looks for a g3 folder after extraction and needs
      // g3/Content/Paks to exist for the patch step; the .keep files carry
      // those directories into the archive.
      return {
        type: "application/zip",
        bytes: storeZip([
          ["g3/Content/Paks/.keep", Buffer.from("")],
          ["g3/Binaries/Win64/.keep", Buffer.from("")],
          ["g3/base", pad("base game")],
        ]),
      };
    default:
      return null;
  }
}

/* ── The signed manifest ──────────────────────────────────────────────────── */

const SIGNING = generateKeyPairSync("ed25519");
/** Raw 32-byte public key as hex, the shape `/manifest.pub` serves. */
const PUBLIC_HEX = SIGNING.publicKey
  .export({ type: "spki", format: "der" })
  .subarray(-32)
  .toString("hex");
const STARTED = Math.floor(Date.now() / 1000);

/** The payloads the manifest lists, keyed the way the launcher looks them up
 *  (CDN-relative, no leading slash). config.ini is deliberately not here: it
 *  is configuration, not a payload, and the launcher never hashes it. */
const PAYLOAD_PATHS = ["/patch/latest.zip", "/patch/dev.zip", "/patch/mod/mod.zip", "/game/elefracbase.zip"];

/** The manifest for the assets as they are built right now, and its signature.
 *  Rebuilt per request: the assets are cheap and `size_mb` may have changed. */
function manifest(state) {
  const u = cfg(state);
  const files = {};
  for (const path of PAYLOAD_PATHS) {
    files[path.slice(1)] = createHash("sha256").update(asset(path, state).bytes).digest("hex");
  }
  const json = Buffer.from(
    JSON.stringify({
      version: Number(u.manifest_version) || STARTED,
      released_at: new Date(STARTED * 1000).toISOString(),
      launcher_version: u.launcher_version ?? "3.2.1",
      files,
    }),
    "utf8"
  );
  return { json, sig: sign(null, json, SIGNING.privateKey) };
}

/** Serve the manifest, its signature, or the public key; false if `path` is
 *  none of them. */
function serveManifest(res, path, state, log) {
  let body;
  let type = "application/octet-stream";
  if (path === "/launcher/manifest.json") {
    body = manifest(state).json;
    type = "application/json";
  } else if (path === "/launcher/manifest.json.sig") {
    body = manifest(state).sig;
  } else if (path === "/launcher/manifest.pub") {
    body = Buffer.from(PUBLIC_HEX + "\n", "utf8");
    type = "text/plain";
  } else {
    return false;
  }
  res.writeHead(200, { "content-type": type, "content-length": body.length });
  res.end(body);
  log?.(`  ${path} — ${body.length} bytes`);
  return true;
}

/** Which stage a path belongs to, for matching against `update.stall`. */
function stageOf(path) {
  if (path === "/patch/latest.zip") return "patch";
  if (path === "/patch/dev.zip") return "playtest";
  if (path === "/patch/mod/mod.zip") return "mod";
  if (path === "/game/elefracbase.zip") return "base";
  return null; // config.ini is never stalled — the version check must return
}

/** True when this asset should hang. `update.stall` is a boolean (every stage)
 *  or one of "patch" | "playtest" | "mod" | "base" to freeze a single step. */
function stalls(path, state) {
  const want = cfg(state).stall;
  if (!want) return false;
  const stage = stageOf(path);
  if (!stage) return false;
  return want === true || want === stage;
}

/** Parse a closed `bytes=start-end` range against a known total. */
function parseRange(header, total) {
  const m = /^bytes=(\d+)-(\d+)$/.exec(header ?? "");
  if (!m) return null;
  const start = Number(m[1]);
  const end = Math.min(Number(m[2]), total - 1);
  if (start > end) return null;
  return { start, end };
}

/**
 * Serve one CDN asset. Returns false if `path` isn't one of ours (let the
 * caller 404). Handles range requests (so the segmented downloader works when
 * a zip is padded past 64 MB) and the stall that reproduces the freeze.
 */
export function serveUpdate(req, res, path, state, log) {
  if (serveManifest(res, path, state, log)) return true;
  const built = asset(path, state);
  if (!built) return false;

  const { type, bytes } = built;
  const total = bytes.length;
  const range = parseRange(req.headers.range, total);
  // download_to_file probes with `Range: bytes=0-0` before committing to a
  // segmented download.
  const isProbe = range && range.start === 0 && range.end === 0;

  if (stalls(path, state) && !isProbe) {
    // Answer with an honest length, stream a slice, then hold the socket open.
    // The client shows progress climb to ~40% and stop — the freeze itself.
    const headers = { "content-type": type, "accept-ranges": "bytes" };
    if (range) {
      headers["content-range"] = `bytes ${range.start}-${range.end}/${total}`;
      res.writeHead(206, { ...headers, "content-length": range.end - range.start + 1 });
    } else {
      res.writeHead(200, { ...headers, "content-length": total });
    }
    const slice = bytes.subarray(range ? range.start : 0);
    res.write(slice.subarray(0, Math.floor(slice.length * 0.4)));
    log?.(`  ${path} — stalling mid-body (headers + 40% sent, socket held)`);
    return true; // never res.end(): the connection hangs
  }

  const headers = { "content-type": type, "accept-ranges": "bytes" };
  if (range) {
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${range.start}-${range.end}/${total}`,
      "content-length": range.end - range.start + 1,
    });
    res.end(bytes.subarray(range.start, range.end + 1));
  } else {
    res.writeHead(200, { ...headers, "content-length": total });
    res.end(bytes);
  }
  log?.(`  ${path} — ${total} bytes${range ? ` (range ${range.start}-${range.end})` : ""}`);
  return true;
}

/** Paths this module answers, for the caller's routing check. */
export const UPDATE_PATHS = [
  "/launcher/config.ini",
  "/patch/latest.zip",
  "/patch/dev.zip",
  "/patch/mod/mod.zip",
  "/game/elefracbase.zip",
  "/launcher/manifest.json",
  "/launcher/manifest.json.sig",
  "/launcher/manifest.pub",
];
