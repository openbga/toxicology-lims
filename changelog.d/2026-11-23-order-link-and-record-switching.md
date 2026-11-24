---
date: 2026-11-23
type: fixed
impact: low
title: Readable order links, and Previous and Next without flicker
area: Orders
link: /orders
---
On **Receive specimens** and **Finish receiving**, the link to the order now reads as the clinic's order number, or **Order · patient name · received date** when none was supplied. The internal order ID is no longer shown, and the breadcrumb on Finish receiving names the order.

On pages with **Previous** and **Next**, the record you are leaving stays on screen, dimmed, until the next one is loaded. The title, status, buttons and **Updated** no longer disappear, so the buttons stay where they are.

## Technical notes

New `useRecordQuery` keeps the previous record as placeholder data and marks the screen as switching; `QueryContent` and `PageHeader` make the stale record's content and actions inert meanwhile. No engine change.
