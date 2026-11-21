---
date: 2026-11-20
type: added
impact: low
title: The user menu shows who is signed in and their roles
---
The menu that opens from your name at the top right now starts with your name and your roles,
such as Accessioner, Analyst, or **All roles** when you hold every role. It is information only,
so you can check which account is signed in before you work.

## Technical notes

`current_session` (`SessionInfo`) adds `roleLabels`: the short names of `roles`, in the same order.
