---
date: 2026-11-20
type: fixed
impact: low
title: Plain folder paths and client names on connections
area: Interfaces
link: /interfaces/connections
---
On Windows, folder paths on Connections, a connection's page and Logs no longer start with `\\?\`, also for folders chosen earlier. The **Partner** of an HL7 Orders connection shows the client's name instead of its code.

## Technical notes

Stored folder paths are kept as they are, so destination checks stay valid; the prefix is removed where paths are shown.
