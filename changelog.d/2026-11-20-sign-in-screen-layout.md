---
date: 2026-11-20
type: changed
impact: medium
title: A clearer sign-in screen with the laboratory name and an analyzers card
---
The sign-in screen names the laboratory under the product name and shows **Sign in** and **Use a security key** as full-width buttons with “or” between them. Under the form, on both the sign-in and lock screens, an **Analyzers** card sums the analyzers up in one line and opens one row per analyzer with its state and last activity, shown as “today 15:53”; whether the rows are open is remembered on this computer. The application version shows at the bottom of the screen.

## Technical notes

`setup_status` also returns `laboratoryName`, the current laboratory profile's name or `null`, so the signed-out screens can show it before anyone signs in.
