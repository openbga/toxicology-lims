---
date: 2026-11-20
type: changed
impact: medium
title: Clearer outcomes for incoming order messages
area: Interfaces
link: /interfaces/logs
---
In Interfaces › Logs a rejected order message names its reason, such as **Rejected – unknown test** or **Rejected – sender not accepted**, and shows a neutral **Resolved – rejected** once someone resolves it; resolved rejections no longer count under **Errors** on Connections. **Record** shows the placer order number for duplicates too, and opens the order that an **Order created** message made.
