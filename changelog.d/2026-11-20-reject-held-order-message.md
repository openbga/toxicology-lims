---
date: 2026-11-20
type: fixed
impact: medium
title: Reject an incoming order held for review
area: Interfaces
link: /interfaces/logs
---
**Reject…** on an incoming order message that is **Held for review** in Interfaces › Logs now rejects it with the reason entered, as it does for one waiting for its patient. The row shows who rejected it and why, and no order is made from it.

## Technical notes

Interfaces migration 0018 lets a held received message change state once, as a waiting one could. It adds no columns and changes no stored data.
