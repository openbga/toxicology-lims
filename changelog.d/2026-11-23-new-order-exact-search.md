---
date: 2026-11-23
type: fixed
impact: low
title: New order patient search shows its full hint and the exact search fields directly
---
On the Patient step of New order, the hint in the search box is no longer cut off. Exact search now shows the Find by identifier and Find by name fields directly, and patients are listed only after you run a search, instead of opening the whole patient list.

## Technical notes

Exact search reuses the Patients page identifier and name search forms and the audited `search_subjects` page; nothing is read until a search runs. No engine change.
