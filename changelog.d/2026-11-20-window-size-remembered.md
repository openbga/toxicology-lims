---
date: 2026-11-20
type: changed
impact: medium
title: The app window opens as you left it
---
The application opens maximized the first time. After that it opens as you closed it: maximized,
or with the same size and position. If that position is on a monitor that is no longer
connected, the window opens on the main monitor instead.

## Technical notes

The window state is kept per computer in `<identifier>.window.json` beside the data folder,
outside the data folder, backups and exports. It holds only window geometry.
