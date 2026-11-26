//! Before 3.0 the app was Nebula Terminal, and kept its settings in folders named
//! after it. The first start of Shelduck copies them to its own folders, so an update
//! opens on the same settings, sessions and profiles. The old folders stay as they
//! were: going back to an older version finds everything where it left it.

use std::{
    env, fs, io,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

/// The app's identifier, which names its data folders (tauri.conf.json).
pub const IDENTIFIER: &str = "dev.awizz.shelduck";
pub const FORMER_IDENTIFIER: &str = "dev.awizz.nebula-terminal";

/// A copy that stopped halfway (the PC was turned off) is started again after this long.
const ABANDONED_AFTER: Duration = Duration::from_secs(10 * 60);

/// The folders that hold one folder per app: settings and local data.
fn roots() -> Vec<PathBuf> {
    let folder = |name: &str| {
        env::var_os(name)
            .filter(|value| !value.is_empty())
            .map(PathBuf::from)
    };
    #[cfg(windows)]
    let roots = [folder("APPDATA"), folder("LOCALAPPDATA")];
    #[cfg(not(windows))]
    let roots = {
        let home = folder("HOME");
        let under_home = |path: &str| home.as_ref().map(|home| home.join(path));
        [
            folder("XDG_CONFIG_HOME").or_else(|| under_home(".config")),
            folder("XDG_DATA_HOME").or_else(|| under_home(".local/share")),
        ]
    };
    roots.into_iter().flatten().collect()
}

/// Run first thing, before the web view opens its storage.
pub fn adopt_settings() {
    for root in roots() {
        let _ = adopt(&root.join(FORMER_IDENTIFIER), &root.join(IDENTIFIER));
    }
}

/// Copies `former` to `current` unless `current` is there already. The copy is built
/// next to it and renamed at the end, so `current` is either complete or missing.
fn adopt(former: &Path, current: &Path) -> io::Result<()> {
    if current.exists() || !former.is_dir() {
        return Ok(());
    }
    let partial = current.with_file_name(format!("{IDENTIFIER}.partial"));
    if let Err(error) = fs::create_dir(&partial) {
        // Another copy of the app is at it, unless it gave up long ago.
        let abandoned = fs::metadata(&partial)
            .and_then(|metadata| metadata.modified())
            .is_ok_and(|modified| {
                SystemTime::now()
                    .duration_since(modified)
                    .is_ok_and(|age| age > ABANDONED_AFTER)
            });
        if !abandoned {
            return Err(error);
        }
        fs::remove_dir_all(&partial)?;
        fs::create_dir(&partial)?;
    }
    copy_folder(former, &partial, true)?;
    fs::rename(&partial, current)
}

/// What isn't worth bringing: caches the web view rebuilds, its lock files, and what
/// the app writes again at every start with this copy's own paths.
fn left_behind(name: &str, is_folder: bool, top_level: bool) -> bool {
    if is_folder {
        return name.to_ascii_lowercase().contains("cache")
            || (top_level && matches!(name, "bin" | "shell-integration"));
    }
    matches!(name, "LOCK" | "lockfile") || name.starts_with("Singleton")
}

fn copy_folder(from: &Path, to: &Path, top_level: bool) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        let name = entry.file_name();
        if kind.is_symlink() || left_behind(&name.to_string_lossy(), kind.is_dir(), top_level) {
            continue;
        }
        if kind.is_dir() {
            copy_folder(&entry.path(), &to.join(&name), false)?;
        } else {
            // A file the old app still holds open is skipped: better most of the settings than none.
            let _ = fs::copy(entry.path(), to.join(&name));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let folder = env::temp_dir().join(format!("shelduck-former-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn write(path: &Path, text: &str) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    #[test]
    fn brings_the_settings_and_leaves_the_rest() {
        let root = scratch("copy");
        let (former, current) = (root.join(FORMER_IDENTIFIER), root.join(IDENTIFIER));
        write(&former.join("custom-profiles.json"), "[1]");
        write(
            &former.join("EBWebView/Default/Local Storage/leveldb/000003.log"),
            "settings",
        );
        write(
            &former.join("EBWebView/Default/Local Storage/leveldb/LOCK"),
            "",
        );
        write(
            &former.join("EBWebView/Default/Code Cache/js/index"),
            "cache",
        );
        write(&former.join("EBWebView/GrShaderCache/data_0"), "cache");
        write(&former.join("bin/nebula-terminal.cmd"), "shim");
        write(&former.join("shell-integration/nebula.bash"), "script");

        adopt(&former, &current).unwrap();

        let read = |path: &str| fs::read_to_string(current.join(path)).ok();
        assert_eq!(read("custom-profiles.json").as_deref(), Some("[1]"));
        assert_eq!(
            read("EBWebView/Default/Local Storage/leveldb/000003.log").as_deref(),
            Some("settings")
        );
        for missing in [
            "EBWebView/Default/Local Storage/leveldb/LOCK",
            "EBWebView/Default/Code Cache",
            "EBWebView/GrShaderCache",
            "bin",
            "shell-integration",
        ] {
            assert!(!current.join(missing).exists(), "{missing} was copied");
        }
        assert!(
            former.join("bin/nebula-terminal.cmd").is_file(),
            "the old folder was touched"
        );
        assert!(!root.join(format!("{IDENTIFIER}.partial")).exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn never_replaces_settings_shelduck_already_has() {
        let root = scratch("keep");
        let (former, current) = (root.join(FORMER_IDENTIFIER), root.join(IDENTIFIER));
        write(&former.join("custom-profiles.json"), "old");
        write(&current.join("custom-profiles.json"), "new");
        adopt(&former, &current).unwrap();
        assert_eq!(
            fs::read_to_string(current.join("custom-profiles.json")).unwrap(),
            "new"
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn leaves_a_copy_in_progress_alone() {
        let root = scratch("busy");
        let (former, current) = (root.join(FORMER_IDENTIFIER), root.join(IDENTIFIER));
        write(&former.join("custom-profiles.json"), "old");
        fs::create_dir(root.join(format!("{IDENTIFIER}.partial"))).unwrap();
        assert!(adopt(&former, &current).is_err());
        assert!(!current.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn the_identifier_is_the_one_tauri_uses() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(config["identifier"], IDENTIFIER);
    }
}
