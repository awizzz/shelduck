//! The ways Windows starts the app in a folder: "Open in Shelduck" in File
//! Explorer, the `shelduck` command, and the folder argument they both pass.

use crate::updater::{install_kind, InstallKind};
use serde::Serialize;
use std::{
    env,
    path::{Path, PathBuf},
};

/// The folder in a command line, if it names one that exists. Relative paths are read
/// from `cwd`, the folder the command was typed in.
pub fn folder_argument(args: &[String], cwd: &Path) -> Option<PathBuf> {
    let argument = args.iter().skip(1).find(|arg| !arg.starts_with('-'))?;
    // Explorer's "%V" turns a drive root into `C:"`: the backslash escapes the quote.
    let mut folder = argument.trim().trim_end_matches('"').to_owned();
    if folder.len() == 2 && folder.ends_with(':') {
        folder.push('\\');
    }
    let path = PathBuf::from(folder);
    let path = if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    };
    path.is_dir().then_some(path)
}

/// The folder this copy was started with, for its first tab.
#[tauri::command]
pub fn launch_folder(app: tauri::AppHandle) -> Option<String> {
    let args: Vec<String> = env::args().collect();
    // An admin copy read its request already. With UAC off, Explorer's admin entry
    // starts an ordinary copy for one instead, and its folder is read here.
    if args.iter().any(|arg| arg == crate::elevation::FLAG) {
        return crate::elevation::take_request(&app, &args).and_then(|request| request.folder);
    }
    let cwd = env::current_dir().unwrap_or_default();
    folder_argument(&args, &cwd).map(|path| path.display().to_string())
}

/// The app's local data folder, as Tauri names it, for code that runs before Tauri does.
pub fn local_data_dir() -> Option<PathBuf> {
    let local = env::var_os("LOCALAPPDATA")?;
    Some(PathBuf::from(local).join(crate::former::IDENTIFIER))
}

/// Where the `shelduck` command lives. It gets a folder of its own because the
/// app's folder also holds `uninstall.exe`, which must never be a command.
fn command_directory() -> Option<PathBuf> {
    local_data_dir().map(|dir| dir.join("bin"))
}

/// Where File Explorer shows the entries: on a folder, inside one, and on a drive.
#[cfg_attr(not(windows), allow(dead_code))]
const MENU_CLASSES: [&str; 3] = [
    r"Software\Classes\Directory",
    r"Software\Classes\Directory\Background",
    r"Software\Classes\Drive",
];

/// One entry of the File Explorer menu.
#[cfg_attr(not(windows), allow(dead_code))]
struct MenuEntry {
    key: String,
    label: &'static str,
    command: String,
    /// The UAC shield next to the label.
    elevated: bool,
}

/// "Open in Shelduck" and its administrator twin, on a folder, the empty space
/// inside a folder, and a drive. The installers remove the same keys on uninstall.
#[cfg_attr(not(windows), allow(dead_code))]
fn menu_entries(exe: &Path) -> Vec<MenuEntry> {
    let exe = exe.display();
    MENU_CLASSES
        .iter()
        .flat_map(|class| {
            [
                MenuEntry {
                    key: format!(r"{class}\shell\Shelduck"),
                    label: "Open in Shelduck",
                    command: format!("\"{exe}\" \"%V\""),
                    elevated: false,
                },
                MenuEntry {
                    key: format!(r"{class}\shell\ShelduckAdmin"),
                    label: "Open in Shelduck (Administrator)",
                    command: format!("\"{exe}\" {} \"%V\"", crate::elevation::EXPLORER_FLAG),
                    elevated: true,
                },
            ]
        })
        .collect()
}

/// For cmd, PowerShell and Shelduck. `start` returns at once instead of waiting for the app.
fn cmd_shim(exe: &Path) -> String {
    let exe = exe.display().to_string().replace('%', "%%");
    format!("@echo off\r\nrem Opens a Shelduck tab, in the folder given if there is one.\r\nstart \"\" \"{exe}\" %*\r\n")
}

/// For Git Bash and WSL, which don't look at `.cmd` files. Same layout as npm's shims.
fn sh_shim(exe: &Path) -> String {
    let exe = exe.display().to_string().replace('\'', r"'\''");
    format!(
        r#"#!/bin/sh
# Opens a Shelduck tab, in the folder given if there is one.
exe='{exe}'
if command -v wslpath >/dev/null 2>&1; then convert=wslpath; else convert=cygpath; fi
if [ $# -gt 0 ]; then
  "$($convert -u "$exe")" "$($convert -w "$1")" >/dev/null 2>&1 &
else
  "$($convert -u "$exe")" >/dev/null 2>&1 &
fi
"#
    )
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Launchers {
    explorer_menu: bool,
    command: bool,
    windows_terminal: bool,
}

/// Adds or removes the Explorer entry and the command, and says which are there. Each
/// value is the user's choice, or `None` if they never made one: an installed copy
/// then adds both, and a portable copy leaves the system alone.
#[tauri::command]
pub fn sync_launchers(
    explorer_menu: Option<bool>,
    command: Option<bool>,
    windows_terminal: Option<bool>,
) -> Result<Launchers, String> {
    let installed = install_kind() != InstallKind::Manual;
    let exe = env::current_exe().map_err(|error| error.to_string())?;
    let local = env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA is not set.")?;
    // First, so a Windows Terminal profile handed over counts as there below.
    retire_former_launchers(Path::new(&local), &exe);
    let fragment = windows_terminal_fragment(Path::new(&local));
    let launchers = Launchers {
        explorer_menu: explorer_menu.unwrap_or(installed),
        command: command.unwrap_or(installed),
        // Another app's settings: only when asked, never by default.
        windows_terminal: windows_terminal.unwrap_or_else(|| fragment.is_file()),
    };
    sync_windows_terminal(&fragment, &exe, launchers.windows_terminal)
        .map_err(|error| format!("Could not update Windows Terminal's profiles: {error}"))?;
    if explorer_menu.is_some() || installed {
        system::sync_explorer_menu(&exe, launchers.explorer_menu)
            .map_err(|error| format!("Could not update the File Explorer menu: {error}"))?;
    }
    if command.is_some() || installed {
        let directory = command_directory().ok_or("LOCALAPPDATA is not set.")?;
        sync_command(&directory, &exe, launchers.command)
            .map_err(|error| format!("Could not update the shelduck command: {error}"))?;
    }
    Ok(launchers)
}

/// A file Windows Terminal reads profiles from at startup, each app in its own folder
/// of `%LOCALAPPDATA%\Microsoft\Windows Terminal\Fragments`.
fn fragment(local: &Path, app: &str, file: &str) -> PathBuf {
    local
        .join("Microsoft")
        .join("Windows Terminal")
        .join("Fragments")
        .join(app)
        .join(file)
}

/// The Shelduck profile of Windows Terminal.
fn windows_terminal_fragment(local: &Path) -> PathBuf {
    fragment(local, "Shelduck", "shelduck.json")
}

/// The command's name before 3.0, kept next to `shelduck` for the scripts that call it.
const FORMER_COMMAND: &str = "nebula-terminal";

/// Whether the app a launcher starts is gone. One that names no app counts as gone.
fn gone(exe: Option<&str>) -> bool {
    !exe.is_some_and(|exe| Path::new(exe).is_file())
}

/// The app a `.cmd` shim starts (see `cmd_shim`).
fn shim_target(shim: &str) -> Option<String> {
    let line = shim.lines().find(|line| line.starts_with("start "))?;
    Some(line.split('"').nth(3)?.replace("%%", "%"))
}

/// Before 3.0 the app was Nebula Terminal, and added its own Explorer entries, command
/// and Windows Terminal profile. Updating removes that app but not these, which then
/// start nothing: they are removed, and the profile is handed over to Shelduck. While
/// that app is still installed they are its own, and stay.
fn retire_former_launchers(local: &Path, exe: &Path) {
    system::remove_former_menu();

    let commands = local.join(crate::former::FORMER_IDENTIFIER).join("bin");
    let shim = std::fs::read_to_string(commands.join(format!("{FORMER_COMMAND}.cmd")));
    if commands.is_dir() && gone(shim.ok().as_deref().and_then(shim_target).as_deref()) {
        let _ = std::fs::remove_dir_all(&commands);
        let _ = system::sync_user_path(&commands, false);
    }

    let former = fragment(local, "Nebula Terminal", "nebula.json");
    let Ok(profile) = std::fs::read_to_string(&former) else {
        return;
    };
    let profile: serde_json::Value = serde_json::from_str(&profile).unwrap_or_default();
    if gone(profile["profiles"][0]["icon"].as_str()) {
        // Same profile id, so Windows Terminal keeps what the user changed in it.
        let _ = sync_windows_terminal(&windows_terminal_fragment(local), exe, true);
        let _ = sync_windows_terminal(&former, exe, false);
    }
}

/// Always the same profile id, so Windows Terminal keeps the user's changes to it.
const WINDOWS_TERMINAL_PROFILE: &str = "{176d5e09-7129-5910-ae63-94207641007d}";

fn windows_terminal_profile(exe: &Path) -> String {
    let shell = exe.with_file_name("shelduck-sh.exe");
    let fragment = serde_json::json!({
        "profiles": [{
            "guid": WINDOWS_TERMINAL_PROFILE,
            "name": "Shelduck",
            "commandline": format!("\"{}\"", shell.display()),
            "icon": exe.display().to_string(),
            "startingDirectory": "%USERPROFILE%",
        }]
    });
    format!(
        "{}\n",
        serde_json::to_string_pretty(&fragment).unwrap_or_default()
    )
}

/// Writes the fragment with this copy's path, or removes it (and its folder, if empty).
fn sync_windows_terminal(fragment: &Path, exe: &Path, enabled: bool) -> std::io::Result<()> {
    if enabled {
        if let Some(folder) = fragment.parent() {
            std::fs::create_dir_all(folder)?;
        }
        return write_if_changed(fragment, &windows_terminal_profile(exe));
    }
    match std::fs::remove_file(fragment) {
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => return Err(error),
        _ => {}
    }
    if let Some(folder) = fragment.parent() {
        let _ = std::fs::remove_dir(folder);
    }
    Ok(())
}

fn sync_command(directory: &Path, exe: &Path, enabled: bool) -> std::io::Result<()> {
    sync_shims(directory, exe, enabled)?;
    system::sync_user_path(directory, enabled)
}

fn sync_shims(directory: &Path, exe: &Path, enabled: bool) -> std::io::Result<()> {
    if enabled {
        std::fs::create_dir_all(directory)?;
        for name in ["shelduck", FORMER_COMMAND] {
            write_if_changed(&directory.join(format!("{name}.cmd")), &cmd_shim(exe))?;
            write_if_changed(&directory.join(name), &sh_shim(exe))?;
        }
        Ok(())
    } else if directory.exists() {
        std::fs::remove_dir_all(directory)
    } else {
        Ok(())
    }
}

fn write_if_changed(path: &Path, content: &str) -> std::io::Result<()> {
    if std::fs::read_to_string(path).ok().as_deref() == Some(content) {
        return Ok(());
    }
    std::fs::write(path, content)
}

/// `shelduck --uninstall`, run by the installers: removes what the app added
/// to Windows, without starting the app.
pub fn uninstall() {
    if let Ok(exe) = env::current_exe() {
        let _ = system::sync_explorer_menu(&exe, false);
    }
    if let Some(directory) = command_directory() {
        let _ = std::fs::remove_dir_all(&directory);
        let _ = system::sync_user_path(&directory, false);
    }
    if let (Some(local), Ok(exe)) = (env::var_os("LOCALAPPDATA"), env::current_exe()) {
        let _ = sync_windows_terminal(&windows_terminal_fragment(Path::new(&local)), &exe, false);
    }
}

/// Entries in a `;`-separated PATH, with `folder` added once or removed everywhere.
/// Everything else is kept as it was, empty entries included.
#[cfg_attr(not(windows), allow(dead_code))]
fn edit_path(path: &str, folder: &str, present: bool) -> Option<String> {
    let same = |entry: &str| {
        entry.trim().trim_end_matches('\\').to_lowercase()
            == folder.trim_end_matches('\\').to_lowercase()
    };
    let found = path.split(';').any(same);
    match (present, found) {
        (true, false) if path.trim().is_empty() => Some(folder.to_owned()),
        (true, false) => Some(format!("{};{folder}", path.trim_end_matches(';'))),
        (false, true) => Some(
            path.split(';')
                .filter(|entry| !same(entry))
                .collect::<Vec<_>>()
                .join(";"),
        ),
        _ => None,
    }
}

#[cfg(windows)]
mod system {
    use std::{io, path::Path};
    use winreg::{
        enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_EXPAND_SZ},
        RegKey, RegValue,
    };

    pub fn sync_explorer_menu(exe: &Path, enabled: bool) -> io::Result<()> {
        let root = RegKey::predef(HKEY_CURRENT_USER);
        let entries = super::menu_entries(exe);
        if !enabled {
            for entry in &entries {
                match root.delete_subkey_all(&entry.key) {
                    Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
                    _ => {}
                }
            }
            return Ok(());
        }
        let current = entries.iter().all(|entry| {
            root.open_subkey(format!(r"{}\command", entry.key))
                .and_then(|key| key.get_value::<String, _>(""))
                .is_ok_and(|value| value == entry.command)
        });
        if current {
            return Ok(());
        }
        for entry in &entries {
            let (key, _) = root.create_subkey(&entry.key)?;
            key.set_value("", &entry.label)?;
            key.set_value("Icon", &format!("\"{}\",0", exe.display()))?;
            if entry.elevated {
                key.set_value("HasLUAShield", &"")?;
            }
            let (command_key, _) = key.create_subkey("command")?;
            command_key.set_value("", &entry.command)?;
        }
        Ok(())
    }

    /// Nebula Terminal's entries, once the app they start is gone.
    pub fn remove_former_menu() {
        let root = RegKey::predef(HKEY_CURRENT_USER);
        for class in super::MENU_CLASSES {
            for name in ["NebulaTerminal", "NebulaTerminalAdmin"] {
                let key = format!(r"{class}\shell\{name}");
                let command = root
                    .open_subkey(format!(r"{key}\command"))
                    .and_then(|key| key.get_value::<String, _>(""));
                if command.is_ok_and(|command| super::gone(command.split('"').nth(1))) {
                    let _ = root.delete_subkey_all(&key);
                }
            }
        }
    }

    fn decode(value: &RegValue) -> String {
        let units: Vec<u16> = value
            .bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_le_bytes(*pair))
            .collect();
        String::from_utf16_lossy(&units)
            .trim_end_matches('\0')
            .to_owned()
    }

    /// Adds or removes `folder` in the user's PATH (`HKCU\Environment`), keeping the
    /// value's type so `%VARIABLES%` in it still expand, and tells Windows it changed.
    pub fn sync_user_path(folder: &Path, present: bool) -> io::Result<()> {
        let environment = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)?;
        let (path, vtype) = match environment.get_raw_value("Path") {
            Ok(value) => (decode(&value), value.vtype),
            Err(error) if error.kind() == io::ErrorKind::NotFound => (String::new(), REG_EXPAND_SZ),
            Err(error) => return Err(error),
        };
        let Some(updated) = super::edit_path(&path, &folder.display().to_string(), present) else {
            return Ok(());
        };
        let bytes: Vec<u8> = updated
            .encode_utf16()
            .chain([0])
            .flat_map(u16::to_le_bytes)
            .collect();
        environment.set_raw_value(
            "Path",
            &RegValue {
                bytes: bytes.into(),
                vtype,
            },
        )?;
        announce_environment_change();
        Ok(())
    }

    /// New shells started from Explorer read the new PATH without signing out.
    fn announce_environment_change() {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE,
        };
        let area: Vec<u16> = "Environment\0".encode_utf16().collect();
        // SAFETY: `area` is a NUL-terminated UTF-16 string that outlives the call, and
        // the result pointer may be null.
        unsafe {
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                0,
                area.as_ptr() as isize,
                SMTO_ABORTIFHUNG,
                2000,
                std::ptr::null_mut(),
            );
        }
    }
}

#[cfg(not(windows))]
mod system {
    use std::{io, path::Path};

    pub fn sync_explorer_menu(_exe: &Path, _enabled: bool) -> io::Result<()> {
        Ok(())
    }

    pub fn remove_former_menu() {}

    pub fn sync_user_path(_folder: &Path, _present: bool) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn args(list: &[&str]) -> Vec<String> {
        std::iter::once("shelduck.exe")
            .chain(list.iter().copied())
            .map(str::to_owned)
            .collect()
    }

    #[test]
    fn reads_the_folder_argument() {
        let base = env::temp_dir().join(format!("shelduck-launch-{}", std::process::id()));
        fs::create_dir_all(base.join("project")).unwrap();
        let absolute = base.join("project");

        assert_eq!(
            folder_argument(&args(&[&absolute.display().to_string()]), Path::new("/")),
            Some(absolute.clone())
        );
        assert_eq!(
            folder_argument(&args(&["--flag", "project"]), &base),
            Some(base.join("project"))
        );
        assert_eq!(folder_argument(&args(&["missing"]), &base), None);
        assert_eq!(folder_argument(&args(&[]), &base), None);
        let _ = fs::remove_dir_all(base);
    }

    #[cfg(windows)]
    #[test]
    fn repairs_a_drive_root_from_explorer() {
        let drive = env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        assert_eq!(
            folder_argument(&args(&[&format!("{drive}\"")]), Path::new(r"C:\")),
            Some(PathBuf::from(format!("{drive}\\")))
        );
    }

    #[test]
    fn explorer_menu_has_an_administrator_entry_for_each_place() {
        let exe = Path::new(r"C:\Program Files\Shelduck\shelduck.exe");
        let entries = menu_entries(exe);
        assert_eq!(entries.len(), 6);
        let admin: Vec<&MenuEntry> = entries.iter().filter(|entry| entry.elevated).collect();
        assert_eq!(admin.len(), 3);
        assert!(admin
            .iter()
            .all(|entry| entry.key.ends_with(r"\shell\ShelduckAdmin")));
        assert_eq!(
            admin[0].command,
            r#""C:\Program Files\Shelduck\shelduck.exe" --open-as-administrator "%V""#
        );
        assert_eq!(
            entries[0].command,
            r#""C:\Program Files\Shelduck\shelduck.exe" "%V""#
        );
        // The flag is skipped when the folder is read back.
        let base = env::temp_dir();
        let launched = args(&["--open-as-administrator", &base.display().to_string()]);
        assert_eq!(folder_argument(&launched, Path::new("/")), Some(base));
    }

    #[test]
    #[cfg(windows)]
    fn windows_terminal_gets_a_shelduck_profile() {
        let folder = env::temp_dir().join(format!("shelduck-wt-{}", std::process::id()));
        let fragment = windows_terminal_fragment(&folder);
        let exe = Path::new(r"C:\Program Files\Shelduck\Shelduck.exe");
        sync_windows_terminal(&fragment, exe, true).unwrap();
        let written: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&fragment).unwrap()).unwrap();
        let profile = &written["profiles"][0];
        assert_eq!(profile["guid"], WINDOWS_TERMINAL_PROFILE);
        assert_eq!(
            profile["commandline"],
            r#""C:\Program Files\Shelduck\shelduck-sh.exe""#
        );
        sync_windows_terminal(&fragment, exe, false).unwrap();
        assert!(!fragment.exists());
        assert!(!fragment.parent().unwrap().exists());
        // Removing what isn't there is fine.
        sync_windows_terminal(&fragment, exe, false).unwrap();
        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn adds_and_removes_one_path_entry() {
        let folder = r"C:\Users\me\AppData\Local\dev.awizz.shelduck\bin";
        assert_eq!(edit_path("", folder, true).as_deref(), Some(folder));
        assert_eq!(
            edit_path(r"C:\tools;", folder, true),
            Some(format!(r"C:\tools;{folder}"))
        );
        assert_eq!(
            edit_path(&format!(r"C:\tools;{folder}\"), folder, true),
            None
        );
        assert_eq!(
            edit_path(
                &format!(r"%USERPROFILE%\bin;;{}\;C:\tools", folder.to_uppercase()),
                folder,
                false
            )
            .as_deref(),
            Some(r"%USERPROFILE%\bin;;C:\tools")
        );
        assert_eq!(edit_path(r"C:\tools", folder, false), None);
    }

    #[test]
    fn shims_quote_the_app_path_for_each_shell() {
        let exe = Path::new(r"C:\Users\O'Brien 100%\Shelduck\shelduck.exe");
        assert!(
            cmd_shim(exe).contains(r#"start "" "C:\Users\O'Brien 100%%\Shelduck\shelduck.exe" %*"#)
        );
        assert!(sh_shim(exe).contains(r"exe='C:\Users\O'\''Brien 100%\Shelduck\shelduck.exe'"));
        assert!(!sh_shim(exe).contains('\r'));
    }

    #[test]
    fn the_command_folder_holds_only_the_shims() {
        let directory = env::temp_dir().join(format!("shelduck-command-{}", std::process::id()));
        let exe = Path::new(r"C:\Shelduck\shelduck.exe");
        sync_shims(&directory, exe, true).unwrap();
        let mut names: Vec<String> = fs::read_dir(&directory)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        assert_eq!(
            names,
            [
                "nebula-terminal",
                "nebula-terminal.cmd",
                "shelduck",
                "shelduck.cmd"
            ]
        );
        sync_shims(&directory, exe, false).unwrap();
        assert!(!directory.exists());
    }

    #[test]
    fn reads_the_app_a_shim_starts() {
        let exe = Path::new(r"C:\Users\O'Brien 100%\Nebula Terminal\nebula-terminal.exe");
        assert_eq!(shim_target(&cmd_shim(exe)).as_deref(), exe.to_str());
        assert_eq!(shim_target("@echo off\r\n"), None);
    }

    /// What Nebula Terminal left in `local`, starting `app`.
    fn former_leftovers(local: &Path, app: &Path) -> (PathBuf, PathBuf) {
        let commands = local.join("dev.awizz.nebula-terminal").join("bin");
        sync_shims(&commands, app, true).unwrap();
        let profile = fragment(local, "Nebula Terminal", "nebula.json");
        sync_windows_terminal(&profile, app, true).unwrap();
        (commands, profile)
    }

    #[test]
    fn takes_over_from_a_nebula_terminal_that_is_gone() {
        let local = env::temp_dir().join(format!("shelduck-retire-{}", std::process::id()));
        let (commands, profile) = former_leftovers(&local, &local.join("nebula-terminal.exe"));

        retire_former_launchers(&local, Path::new(r"C:\Shelduck\shelduck.exe"));

        assert!(!commands.exists());
        assert!(!profile.parent().unwrap().exists());
        assert!(windows_terminal_fragment(&local).is_file());
        let _ = fs::remove_dir_all(local);
    }

    #[test]
    fn leaves_a_nebula_terminal_that_is_still_installed_alone() {
        let local = env::temp_dir().join(format!("shelduck-keep-{}", std::process::id()));
        fs::create_dir_all(&local).unwrap();
        let app = local.join("nebula-terminal.exe");
        fs::write(&app, "").unwrap();
        let (commands, profile) = former_leftovers(&local, &app);

        retire_former_launchers(&local, Path::new(r"C:\Shelduck\shelduck.exe"));

        assert!(commands.join("nebula-terminal.cmd").is_file());
        assert!(profile.is_file());
        assert!(!windows_terminal_fragment(&local).exists());
        let _ = fs::remove_dir_all(local);
    }
}
