//! The main window opens as it was closed (ticket #4865): maximized, or with the same size
//! and position. The first start opens maximized. A saved position that no connected
//! monitor shows, such as one on a monitor that was unplugged, opens centred on the primary
//! monitor instead.
//!
//! The state is kept per computer in `<local data>/<identifier>.window.json`, beside the
//! installation choice ([`crate::installation`]), so the laboratory's and the demo's data
//! folders, backups and exports never include it. It holds window geometry in physical
//! pixels and nothing else: no PHI. It is written when the main window is closed or the app
//! exits. A missing or unreadable file means a first start, and a failed read or write is
//! logged without stopping the app. The main window is created hidden (`tauri.conf.json`)
//! and shown once it is placed.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};

use crate::MAIN_WINDOW;
use crate::installation::sibling;

/// The state file's suffix.
const SUFFIX: &str = ".window.json";

/// A rectangle in physical pixels: a window's outer position and inner size, or a monitor.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
struct Rect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl Rect {
    fn center(self) -> (i64, i64) {
        (
            i64::from(self.x) + i64::from(self.width) / 2,
            i64::from(self.y) + i64::from(self.height) / 2,
        )
    }

    fn contains(self, (x, y): (i64, i64)) -> bool {
        let (left, top) = (i64::from(self.x), i64::from(self.y));
        x >= left
            && y >= top
            && x < left + i64::from(self.width)
            && y < top + i64::from(self.height)
    }
}

/// How the main window was closed. `bounds` is its last size and position while it was not
/// maximized, kept so that restoring a maximized window returns to them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
struct WindowState {
    maximized: bool,
    bounds: Option<Rect>,
}

/// The file the main window's state is kept in.
#[derive(Debug)]
pub(crate) struct WindowStateFile(PathBuf);

impl WindowStateFile {
    /// The file beside the laboratory data folder `data`; `None` when it has no parent or
    /// name.
    fn beside(data: &Path) -> Option<Self> {
        sibling(data, SUFFIX).map(Self)
    }

    fn read(&self) -> Option<WindowState> {
        let text = match fs::read_to_string(&self.0) {
            Ok(text) => text,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return None,
            Err(error) => {
                tracing::warn!(%error, "reading the window state");
                return None;
            }
        };
        serde_json::from_str(&text)
            .inspect_err(|error| tracing::warn!(%error, "window state file is unreadable"))
            .ok()
    }

    /// Replaces the file in one rename, as the installation choice does.
    fn write(&self, state: WindowState) -> io::Result<()> {
        if let Some(parent) = self.0.parent() {
            fs::create_dir_all(parent)?;
        }
        let partial = self.0.with_extension("json-new");
        {
            let mut file = fs::File::create(&partial)?;
            file.write_all(&serde_json::to_vec(&state).map_err(io::Error::other)?)?;
            file.sync_all()?;
        }
        fs::rename(&partial, &self.0)
    }
}

/// Where the saved bounds go: unchanged while a connected monitor shows the window's centre;
/// otherwise the same size, no larger than the primary monitor, centred on it. `None` keeps
/// the default placement.
fn placed(saved: Rect, monitors: &[Rect], primary: Option<Rect>) -> Option<Rect> {
    if monitors
        .iter()
        .any(|monitor| monitor.contains(saved.center()))
    {
        return Some(saved);
    }
    let primary = primary?;
    let width = saved.width.min(primary.width);
    let height = saved.height.min(primary.height);
    Some(Rect {
        x: primary.x.saturating_add(half_gap(primary.width, width)),
        y: primary.y.saturating_add(half_gap(primary.height, height)),
        width,
        height,
    })
}

/// Half the space left when `inner` is placed in `outer`.
fn half_gap(outer: u32, inner: u32) -> i32 {
    i32::try_from(outer.saturating_sub(inner) / 2).unwrap_or(0)
}

fn area(monitor: &Monitor) -> Rect {
    let (position, size) = (monitor.position(), monitor.size());
    Rect {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }
}

/// Places the hidden main window as it was closed, or maximized on the first start, and
/// shows it. Keeps the state file for [`save`].
pub(crate) fn open_main<R: Runtime>(app: &AppHandle<R>) {
    let file = app
        .path()
        .app_local_data_dir()
        .ok()
        .and_then(|data| WindowStateFile::beside(&data));
    let state = file.as_ref().and_then(WindowStateFile::read);
    if let Some(file) = file {
        app.manage(file);
    }
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        tracing::warn!("main window not found");
        return;
    };
    if let Some(saved) = state.and_then(|state| state.bounds) {
        place(&window, saved);
    }
    let maximized = state.is_none_or(|state| state.maximized);
    let shown = window
        .show()
        .and_then(|()| if maximized { window.maximize() } else { Ok(()) });
    if let Err(error) = shown {
        tracing::warn!(%error, "showing the main window");
    }
}

/// Moves and sizes the window to the saved bounds, or onto the primary monitor when no
/// connected monitor shows them.
fn place<R: Runtime>(window: &WebviewWindow<R>, saved: Rect) {
    let monitors: Vec<Rect> = window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(area)
        .collect();
    let primary = window.primary_monitor().ok().flatten().map(|m| area(&m));
    let Some(rect) = placed(saved, &monitors, primary) else {
        return;
    };
    let result = window
        .set_position(PhysicalPosition::new(rect.x, rect.y))
        .and_then(|()| window.set_size(PhysicalSize::new(rect.width, rect.height)));
    if let Err(error) = result {
        tracing::warn!(%error, "placing the main window");
    }
}

/// Saves how the main window is now. A minimized window keeps the earlier state, and a
/// maximized one keeps the earlier bounds, since neither shows the size to return to.
pub(crate) fn save<R: Runtime>(app: &AppHandle<R>) {
    let (Some(window), Some(file)) = (
        app.get_webview_window(MAIN_WINDOW),
        app.try_state::<WindowStateFile>(),
    ) else {
        return;
    };
    if window.is_minimized().unwrap_or(true) {
        return;
    }
    let maximized = window.is_maximized().unwrap_or(false);
    let bounds = if maximized {
        file.read().and_then(|state| state.bounds)
    } else {
        window
            .outer_position()
            .and_then(|position| Ok((position, window.inner_size()?)))
            .ok()
            .map(|(position, size)| Rect {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            })
    };
    if let Err(error) = file.write(WindowState { maximized, bounds }) {
        tracing::warn!(%error, "saving the window state");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const fn rect(x: i32, y: i32, width: u32, height: u32) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    const PRIMARY: Rect = rect(0, 0, 1920, 1080);
    const RIGHT: Rect = rect(1920, 0, 2560, 1440);

    #[test]
    fn a_window_on_a_connected_monitor_stays_where_it_was() {
        let saved = rect(2100, 100, 1400, 900);
        assert_eq!(placed(saved, &[PRIMARY, RIGHT], Some(PRIMARY)), Some(saved));
    }

    #[test]
    fn a_window_on_a_disconnected_monitor_is_centred_on_the_primary_one() {
        let saved = rect(2100, 100, 1400, 900);
        assert_eq!(
            placed(saved, &[PRIMARY], Some(PRIMARY)),
            Some(rect(260, 90, 1400, 900))
        );
    }

    #[test]
    fn a_window_larger_than_the_primary_monitor_is_made_to_fit() {
        let saved = rect(2000, 0, 2500, 1400);
        assert_eq!(placed(saved, &[PRIMARY], Some(PRIMARY)), Some(PRIMARY));
    }

    #[test]
    fn without_a_primary_monitor_the_default_placement_is_kept() {
        assert_eq!(placed(rect(-5000, 0, 1280, 800), &[], None), None);
    }

    #[test]
    fn the_state_survives_a_write_and_read() {
        let folder = tempfile::tempdir().unwrap();
        let file = WindowStateFile::beside(&folder.path().join("org.example.lis")).unwrap();
        assert_eq!(file.read(), None);
        let state = WindowState {
            maximized: true,
            bounds: Some(rect(-1200, 40, 1280, 800)),
        };
        file.write(state).unwrap();
        assert_eq!(file.read(), Some(state));
        assert!(folder.path().join("org.example.lis.window.json").is_file());
    }

    #[test]
    fn an_unreadable_file_means_a_first_start() {
        let folder = tempfile::tempdir().unwrap();
        let file = WindowStateFile::beside(&folder.path().join("org.example.lis")).unwrap();
        fs::write(
            folder.path().join("org.example.lis.window.json"),
            "not json",
        )
        .unwrap();
        assert_eq!(file.read(), None);
    }
}
