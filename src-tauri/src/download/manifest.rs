//! The signed release manifest: the one list of bytes this launcher will put
//! on disk.
//!
//! HTTPS proves a download came from whoever holds the CDN's certificate. That
//! is the party a compromised CDN *is*, so it proves nothing useful about the
//! payload. The manifest closes that gap: the release pipeline hashes every
//! payload, signs the list with a key the CDN never sees, and uploads it
//! beside the payloads. Before anything is extracted, run or swapped in, its
//! SHA-256 has to match the entry here. No entry, no signature, a bad
//! signature: the install is refused and what is on disk is left alone.
//!
//! `version` is what stops a replay: an attacker with the bucket can
//! re-publish an *old*, still validly signed manifest (say, one whose launcher
//! entry is a build with a known hole). Every install remembers the highest
//! version it has accepted (`settings.manifest_version`) and refuses a lower
//! one.
//!
//! What this does not cover: availability (a wiped bucket means no update,
//! not a bad one), and a stolen signing key. The key lives with the release
//! tooling, not here; see `scripts/sign-manifest.sh`.

use crate::error::{AppError, AppResult, ErrorCode};
use crate::settings;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::time::Duration;

/// Raw ed25519 public keys a manifest may be signed with. A list rather than a
/// single key so a key can be retired: ship a build that accepts both, sign
/// with the new one once every install has updated, then drop the old one.
const RELEASE_KEYS: &[[u8; 32]] = &[
    // ef-release.key, generated 2026-09-10.
    [
        0x60, 0x87, 0xcf, 0xbe, 0x75, 0x29, 0x33, 0xf5,
        0xd0, 0x7f, 0x8b, 0x39, 0x3c, 0xd3, 0xb8, 0x97,
        0x0e, 0x10, 0x43, 0x16, 0x34, 0xa0, 0x9f, 0x43,
        0x18, 0x8d, 0xaf, 0x7d, 0x28, 0xab, 0xb8, 0xdd,
    ],
];

/// The CDN object and its detached signature (64 raw bytes, what
/// `openssl pkeyutl -sign` writes for ed25519).
pub const MANIFEST_PATH: &str = "launcher/manifest.json";
pub const SIGNATURE_PATH: &str = "launcher/manifest.json.sig";

#[derive(Deserialize, Debug, Clone)]
pub struct Manifest {
    /// Monotonic. The release tooling stamps the publish time in seconds, so
    /// a later release is always a higher number.
    pub version: u64,
    // Part of the signed document (sign-manifest.sh writes both) for whoever
    // reads it by hand; the launcher itself never acts on them.
    #[serde(default)]
    #[allow(dead_code)]
    pub released_at: String,
    #[serde(default)]
    #[allow(dead_code)]
    pub launcher_version: String,
    /// CDN-relative path → lowercase hex SHA-256. Every payload the launcher
    /// downloads is keyed here; a missing key fails the download.
    pub files: BTreeMap<String, String>,
    /// Payloads that are also published as fixed-size parts, keyed like
    /// `files`. Cloudflare caches objects up to 512 MB and streams anything
    /// bigger from the origin every time, so the 11 GB base archive is cut
    /// into cacheable pieces; a launcher that finds an entry here fetches the
    /// parts and reassembles, one that does not (or an older manifest without
    /// this map) fetches the whole object. The reassembled file still has to
    /// hash to its `files` entry.
    #[serde(default)]
    pub parts: BTreeMap<String, Parts>,
}

/// How one payload is split: `dir/<sha256>.bin` per part, in order, every
/// part `size` bytes except the last.
#[derive(Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct Parts {
    /// CDN directory holding the parts, e.g. `game/base`.
    pub dir: String,
    /// Bytes per part (the last one may be shorter).
    pub size: u64,
    /// Lowercase hex SHA-256 of each part, in file order. Doubles as the
    /// part's file name, so a part is a content-addressed object the CDN
    /// can cache for a year.
    pub sha256: Vec<String>,
}

impl Parts {
    /// CDN-relative path of part `i`.
    pub fn path(&self, i: usize) -> String {
        format!("{}/{}.bin", self.dir.trim_matches('/'), self.sha256[i])
    }
}

fn is_hex_sha256(h: &str) -> bool {
    h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit())
}

impl Manifest {
    /// The part list for `key`, if this manifest publishes one that is usable:
    /// at least one part, a positive part size, every hash well-formed. A
    /// malformed list is treated as absent, which falls back to the whole
    /// object rather than failing the install.
    pub fn parts_for(&self, key: &str) -> Option<&Parts> {
        self.parts.get(key).filter(|p| {
            p.size > 0 && !p.dir.is_empty() && !p.sha256.is_empty() && p.sha256.iter().all(|h| is_hex_sha256(h))
        })
    }

    /// The hash a payload has to match, or a refusal naming the payload.
    pub fn hash_for(&self, key: &str) -> AppResult<&str> {
        self.files
            .get(key)
            .map(String::as_str)
            .filter(|h| h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit()))
            .ok_or_else(|| AppError::new(ErrorCode::ManifestMissingFile).with("file", key))
    }
}

/// Lowercase hex SHA-256 of a byte slice.
pub fn sha256_hex(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

pub fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

/// True when `sig` is a valid signature over `json` by any of `keys`.
fn signed_by_any(json: &[u8], sig: &[u8], keys: &[[u8; 32]]) -> bool {
    let Ok(sig) = <[u8; 64]>::try_from(sig).map(|b| Signature::from_bytes(&b)) else {
        return false;
    };
    keys.iter().any(|k| {
        VerifyingKey::from_bytes(k)
            .map(|vk| vk.verify_strict(json, &sig).is_ok())
            .unwrap_or(false)
    })
}

/// Check the signature, then parse. Parsing an unsigned document would let a
/// malformed one shape the error before it was proven to be ours.
pub(super) fn parse_verified(json: &[u8], sig: &[u8], keys: &[[u8; 32]]) -> AppResult<Manifest> {
    if !signed_by_any(json, sig, keys) {
        return Err(AppError::new(ErrorCode::ManifestSignatureInvalid));
    }
    serde_json::from_slice(json).map_err(|e| AppError::detail(ErrorCode::ManifestUnavailable, e))
}

async fn fetch_bytes(client: &reqwest::Client, url: &str) -> AppResult<Vec<u8>> {
    let resp = client
        .get(url)
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| AppError::detail(ErrorCode::ManifestUnavailable, e).with("url", url))?;
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| AppError::detail(ErrorCode::ManifestUnavailable, e).with("url", url))?;
    Ok(bytes.to_vec())
}

/// The keys this build trusts. Release builds trust the compiled-in list and
/// nothing else. A debug build additionally accepts the key the local test
/// env publishes at `{cdn}/launcher/manifest.pub` (it mints a throwaway pair on start),
/// so the update flow can be driven against fixture bytes without the real
/// signing key ever being near a dev box.
async fn trusted_keys(client: &reqwest::Client, cdn: &str) -> Vec<[u8; 32]> {
    // Only the debug-only block below pushes to it.
    #[cfg_attr(not(debug_assertions), allow(unused_mut))]
    let mut keys: Vec<[u8; 32]> = RELEASE_KEYS.to_vec();
    #[cfg(debug_assertions)]
    {
        if let Ok(bytes) = fetch_bytes(client, &format!("{cdn}/launcher/manifest.pub")).await {
            let text = String::from_utf8_lossy(&bytes);
            let text = text.trim();
            if text.len() == 64 {
                let mut k = [0u8; 32];
                let ok = (0..32).all(|i| {
                    u8::from_str_radix(&text[i * 2..i * 2 + 2], 16)
                        .map(|b| {
                            k[i] = b;
                        })
                        .is_ok()
                });
                if ok {
                    keys.push(k);
                }
            }
        }
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = (client, cdn);
    }
    keys
}

/// Fetch, verify and parse the manifest, and refuse one older than the newest
/// this install has already accepted. Called once per install/update run and
/// threaded through to each download, so one run sees one consistent list.
pub(crate) async fn fetch_manifest(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    cdn: &str,
) -> AppResult<Manifest> {
    let json = fetch_bytes(client, &format!("{cdn}/{MANIFEST_PATH}")).await?;
    let sig = fetch_bytes(client, &format!("{cdn}/{SIGNATURE_PATH}")).await?;
    let keys = trusted_keys(client, cdn).await;
    let manifest = parse_verified(&json, &sig, &keys)?;

    let seen = settings::load(app).manifest_version;
    if manifest.version < seen {
        return Err(AppError::new(ErrorCode::ManifestRolledBack)
            .with("seen", seen)
            .with("offered", manifest.version));
    }
    if manifest.version > seen {
        settings::mutate(app, |s| s.manifest_version = manifest.version)?;
    }
    Ok(manifest)
}

#[cfg(test)]
#[path = "__tests/manifest.rs"]
mod tests;
