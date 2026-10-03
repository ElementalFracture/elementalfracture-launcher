//! Failures, as something the frontend can translate.
//!
//! A command that fails hands back a *code* plus the values that belong in the
//! sentence, never the sentence itself — the prose lives in the UI catalogues
//! (`ui/i18n/`), which are the only place that knows what language the user
//! reads. `ui/i18n/errors.ts` maps each code to a message and interpolates
//! `params` into it.
//!
//! Two kinds of code live here, and the split is deliberate:
//!
//! * **Authored** — a condition we recognised and have something useful to say
//!   about ("set the game folder first"). Fully translatable.
//! * **Pass-through** — something below us failed and all we have is its own
//!   English text (an `io::Error`, a reqwest timeout). The code translates the
//!   *frame* ("Couldn't write the file: …") and `params["detail"]` carries the
//!   library's words untouched. Better than nothing, and honest about it.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;

/// Every failure the UI can be asked to render. Serialised in camelCase, so
/// the generated bindings give the frontend a string union to switch on.
#[derive(Serialize, Deserialize, specta::Type, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    /* ---- authored: the game folder and what's in it ---- */
    /// No game_path set yet.
    NoGameFolder,
    /// The chosen folder isn't a Spellbreak install.
    NotSpellbreakInstall,
    /// `params: path`
    PaksNotFound,
    /// `params: variant`
    UnknownVariant,
    /// The balance pak for a variant isn't installed. `params: pak`
    VariantPakMissing,
    /// Same, for the playtest balance, which is fetched separately.
    /// `params: pak`
    PlaytestPakMissing,
    /// `params: dir, names`
    NoGameBinary,

    /* ---- authored: downloads ---- */
    /// A "zip" small enough to be an error page the CDN served with a 200.
    ModArchiveTooSmall,
    LauncherArchiveTooSmall,
    /// The playtest archive held no .pak.
    PlaytestArchiveEmpty,
    /// umu-run missing from the runtime archive we just unpacked.
    RuntimeMissingUmu,
    /// The server stopped honouring range requests mid-resume.
    RangeRequestsUnsupported,
    /// `params: range, remaining`
    DownloadStalled,
    /// Self-update is deliberately off in dev builds.
    LauncherUpdateDisabledInDev,
    /// The launcher started a game that is still running; the update waits for it.
    LauncherUpdateWaitsForGame,
    /// Files that still didn't read back as the archive's bytes after being
    /// written again. `params: count, files`
    ExtractionMismatch,
    /// The drive can't hold what the install needs. `params: need, free, path`
    NotEnoughSpace,
    /// The install archive unpacked without the folder the game lives in.
    ArchiveMissingGameFolder,
    /// The CDN would not give up the archive's file listing (no range support,
    /// an error page, a truncated directory), so an install cannot be checked
    /// against it.
    ArchiveListingUnavailable,
    /// The runtime tarball ended mid-entry or has an unreadable header.
    RuntimeArchiveCorrupt,
    /// No runtime, and no python3 to run the umu zipapp with.
    RuntimeNeedsPython,
    /// The CDN answered but the version file was unreadable.
    LauncherVersionUnreadable,
    /// An archive that unpacks to more than the ceiling — a decompression
    /// bomb, or a payload that has outgrown the limit. `params: size, limit`
    ArchiveTooLarge,

    /* ---- authored: the signed manifest (download/manifest.rs) ---- */
    /// The manifest's signature doesn't check out against any trusted key.
    ManifestSignatureInvalid,
    /// The CDN offered a manifest older than one this install has already
    /// accepted. `params: seen, offered`
    ManifestRolledBack,
    /// A payload the launcher wanted has no entry in the manifest.
    /// `params: file`
    ManifestMissingFile,
    /// A finished download doesn't hash to what the manifest says.
    /// `params: file, expected, actual`
    DownloadHashMismatch,

    /* ---- authored: account ---- */
    /// A signed-in session is required and there isn't one.
    NotSignedIn,
    PlayersUrlNotConfigured,
    EnterEmailAndPassword,
    SignInNotConfigured,
    SignInFailed,
    WrongCredentials,
    EmailUnverified,
    RateLimited,
    /// Permanent. `params: reason` (optional)
    AccountSuspended,
    /// Timed. `params: ends`, `reason` (optional)
    AccountSuspendedUntil,

    /* ---- authored: the launch wrapper ---- */
    /// `params: wrapper, onHost` ("true" when we're in a container and the
    /// wrapper is missing on the *host* specifically).
    WrapperNotInstalled,
    /// A Proton run would silently convert someone else's Wine prefix.
    /// `params: prefix, wrapper`
    ForeignWinePrefix,

    /* ---- authored: Steam (steam/link.rs) ---- */
    /// No native Steam client on this machine.
    SteamNotFound,
    /// Steam is running and would overwrite the change when it exits.
    SteamRunning,
    /// Steam has never been signed into here, so there's no account to write for.
    SteamNoUser,
    /// Linking needs Spellbreak installed through Steam.
    SpellbreakNotInSteam,

    /* ---- authored: misc ---- */
    /// A link that isn't http(s), refused rather than handed to the OS.
    UnsupportedLinkScheme,

    /* ---- pass-through: the frame is ours, the detail isn't ---- */
    /// `params: detail` — an `io::Error`, usually with the path in it.
    Io,
    /// `params: detail` — reqwest.
    Network,
    /// `params: detail` — a corrupt or unreadable zip.
    BadArchive,
    /// `params: detail` — an archive entry whose name we can't use safely.
    BadArchiveEntry,
    /// `params: detail`
    BadJson,
    /// `params: url, detail`
    DownloadFailed,
    /// `params: url, detail` — the manifest or its signature couldn't be
    /// fetched, or the (verified) document wouldn't parse.
    ManifestUnavailable,
    /// `params: detail` — installing the mod payload.
    ModDownloadFailed,
    /// `params: command, detail` — spawning the game.
    LaunchFailed,
    /// A Steam config file that wouldn't parse; left untouched. `params: file, detail`
    SteamConfigUnreadable,
    /// `params: detail` — the sign-in host didn't answer.
    SignInUnreachable,
    /// `params: detail` — no OS app-data directory.
    NoAppDataDir,
    /// `params: detail` — chmod +x on the unpacked umu-run.
    RuntimeNotExecutable,
    /// The patch landed but the version stamp didn't. `params: detail`
    /// The patch archive extracted but did not contain the balance pak.
    PatchPakMissing,
    /// A pak that ships signed has lost its `.sig`, so the game cannot mount
    /// it. Repairable: `verify_game_files` puts the file back.
    PakSignatureMissing,
    PatchVersionWriteFailed,
    /// Self-update, at each of the three points it can fail after downloading.
    /// `params: detail`
    LauncherStageFailed,
    /// The old binary is already parked at this point — see the code's
    /// message, which tells the user what state they're in. `params: detail`
    LauncherInstallFailed,
    /// Installed fine, but the relaunch didn't take. `params: detail`
    LauncherRestartFailed,
    /// A background worker panicked or was cancelled. `params: detail`
    BackgroundTaskFailed,
}

/// A failure on its way to the UI: what went wrong, and the values that go in
/// the sentence. `params` is empty for codes that say everything on their own.
#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
pub struct AppError {
    pub code: ErrorCode,
    pub params: BTreeMap<String, String>,
}

impl AppError {
    pub fn new(code: ErrorCode) -> Self {
        Self {
            code,
            params: BTreeMap::new(),
        }
    }

    /// Add one interpolation value. Chainable:
    /// `AppError::new(PaksNotFound).with("path", p.display())`
    pub fn with(mut self, key: &str, value: impl fmt::Display) -> Self {
        self.params.insert(key.to_string(), value.to_string());
        self
    }

    /// The common pass-through shape: a code whose message ends in the
    /// underlying error's own words.
    pub fn detail(code: ErrorCode, detail: impl fmt::Display) -> Self {
        Self::new(code).with("detail", detail)
    }
}

/// So a bare `?` still works on the io/network/zip/json calls that make up most
/// of the fallible code here — without this every one of them would need a
/// `map_err`, which is how they all ended up stringly-typed in the first place.
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::detail(ErrorCode::Io, e)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        Self::detail(ErrorCode::Network, e)
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(e: zip::result::ZipError) -> Self {
        Self::detail(ErrorCode::BadArchive, e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::detail(ErrorCode::BadJson, e)
    }
}

/// Only for logs and `expect` — the user never reads this. Their copy is built
/// from `code` in the frontend catalogue.
impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}", self.code)?;
        for (k, v) in &self.params {
            write!(f, " {k}={v}")?;
        }
        Ok(())
    }
}

impl std::error::Error for AppError {}

/// What every fallible command returns.
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
#[path = "__tests/error.rs"]
mod tests;
