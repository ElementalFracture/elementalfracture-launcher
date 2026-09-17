//! The Steam client on this machine: where it lives, whether it's running,
//! who last signed in, and what's installed.

use super::vdf;
use std::fs;
use std::path::{Path, PathBuf};

/// A SteamID64 minus this is the account id `userdata/` is keyed by.
const STEAMID64_BASE: u64 = 76_561_197_960_265_728;

pub struct Steam {
    pub root: PathBuf,
}

/// A Steam root has both of these; a stale `~/.steam` symlink doesn't.
fn looks_like_steam(p: &Path) -> bool {
    p.join("steamapps").is_dir() && p.join("config").is_dir()
}

#[cfg(windows)]
mod win {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Registry::{
        RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RRF_RT_REG_SZ,
    };
    use windows_sys::Win32::System::Threading::{
        GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }

    pub fn reg_string(subkey: &str, value: &str) -> Option<String> {
        let (subkey, value) = (wide(subkey), wide(value));
        let mut buf = vec![0u16; 1024];
        let mut size = (buf.len() * 2) as u32;
        let rc = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                subkey.as_ptr(),
                value.as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buf.as_mut_ptr().cast(),
                &mut size,
            )
        };
        if rc != 0 {
            return None;
        }
        let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        Some(String::from_utf16_lossy(&buf[..len]))
    }

    pub fn reg_dword(subkey: &str, value: &str) -> Option<u32> {
        let (subkey, value) = (wide(subkey), wide(value));
        let mut data = 0u32;
        let mut size = 4u32;
        let rc = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                subkey.as_ptr(),
                value.as_ptr(),
                RRF_RT_REG_DWORD,
                std::ptr::null_mut(),
                (&mut data as *mut u32).cast(),
                &mut size,
            )
        };
        (rc == 0).then_some(data)
    }

    pub fn process_alive(pid: u32) -> bool {
        const STILL_ACTIVE: u32 = 259;
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return false;
            }
            let mut code = 0u32;
            let ok = GetExitCodeProcess(handle, &mut code) != 0;
            CloseHandle(handle);
            ok && code == STILL_ACTIVE
        }
    }
}

impl Steam {
    /// The native client only. Flatpak Steam can't run a launcher outside its
    /// sandbox, so offering to wire one into it would only set up a failure.
    pub fn locate() -> Option<Steam> {
        #[cfg(windows)]
        let candidates: Vec<PathBuf> = win::reg_string(r"Software\Valve\Steam", "SteamPath")
            .map(PathBuf::from)
            .into_iter()
            .chain([PathBuf::from(r"C:\Program Files (x86)\Steam")])
            .collect();
        #[cfg(not(windows))]
        let candidates: Vec<PathBuf> = std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| {
                [".steam/root", ".steam/steam", ".local/share/Steam"]
                    .iter()
                    .map(|p| home.join(p))
                    .collect()
            })
            .unwrap_or_default();
        candidates
            .into_iter()
            .find(|p| looks_like_steam(p))
            .map(|p| Steam { root: fs::canonicalize(&p).unwrap_or(p) })
    }

    /// Steam holds its config in memory and writes it back on exit, so an
    /// edit made while it runs is lost. Every write checks this first.
    pub fn running(&self) -> bool {
        #[cfg(windows)]
        {
            win::reg_dword(r"Software\Valve\Steam\ActiveProcess", "pid")
                .is_some_and(|pid| pid != 0 && win::process_alive(pid))
        }
        #[cfg(not(windows))]
        {
            let Ok(procs) = fs::read_dir("/proc") else { return false };
            procs.flatten().any(|p| {
                fs::read_to_string(p.path().join("comm")).is_ok_and(|c| c.trim_end() == "steam")
            })
        }
    }

    /// The account Steam signs into next: the most recent login, or the only
    /// account that has a userdata folder.
    pub fn active_user(&self) -> Option<String> {
        let userdata = self.root.join("userdata");
        let exists = |id: &str| userdata.join(id).join("config").is_dir();
        if let Some(users) = fs::read_to_string(self.root.join("config").join("loginusers.vdf"))
            .ok()
            .and_then(|s| vdf::parse_text(&s).ok())
            .and_then(|t| t.obj("users").cloned())
        {
            let recent = users.0.iter().find_map(|(id, v)| match v {
                vdf::Value::Obj(u) if u.str("MostRecent") == Some("1") => Some(id.clone()),
                _ => None,
            });
            if let Some(account) = recent
                .and_then(|id| id.parse::<u64>().ok())
                .and_then(|id| id.checked_sub(STEAMID64_BASE))
                .map(|a| a.to_string())
                .filter(|a| exists(a))
            {
                return Some(account);
            }
        }
        let mut accounts: Vec<String> = fs::read_dir(&userdata)
            .ok()?
            .flatten()
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|n| n != "0" && n.chars().all(|c| c.is_ascii_digit()) && exists(n))
            .collect();
        (accounts.len() == 1).then(|| accounts.remove(0))
    }

    pub fn user_config(&self, account: &str) -> PathBuf {
        self.root.join("userdata").join(account).join("config")
    }

    #[cfg_attr(windows, allow(dead_code))]
    pub fn config_vdf(&self) -> PathBuf {
        self.root.join("config").join("config.vdf")
    }

    #[cfg_attr(windows, allow(dead_code))]
    pub fn compat_tools_dir(&self) -> PathBuf {
        self.root.join("compatibilitytools.d")
    }

    /// Every library folder, the root's own included.
    fn libraries(&self) -> Vec<PathBuf> {
        let mut libs = vec![self.root.clone()];
        if let Some(tree) = fs::read_to_string(self.root.join("steamapps").join("libraryfolders.vdf"))
            .ok()
            .and_then(|s| vdf::parse_text(&s).ok())
        {
            if let Some(folders) = tree.obj("libraryfolders") {
                for (_, v) in &folders.0 {
                    if let vdf::Value::Obj(f) = v {
                        if let Some(p) = f.str("path") {
                            libs.push(PathBuf::from(p));
                        }
                    }
                }
            }
        }
        libs
    }

    pub fn app_installed(&self, appid: &str) -> bool {
        let manifest = format!("appmanifest_{appid}.acf");
        self.libraries()
            .iter()
            .any(|lib| lib.join("steamapps").join(&manifest).is_file())
    }
}

#[cfg(test)]
#[path = "__tests/client.rs"]
mod tests;
