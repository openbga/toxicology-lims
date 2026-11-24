---
name: changelog-entry
description: Record a change that users, deployers or integrators can observe as one entry file in changelog.d/, rate its impact, word it for laboratory staff and check it. CHANGELOG.md and the in-app What's new list are generated, never committed in a feature branch. Use in every change that alters what the application does, shows, stores, sends or needs to install, and when a branch still edits CHANGELOG.md by hand.
---

# Changelog entry

`changelog.d/` is the only source of the change history. `python3 scripts/changelog.py`
generates [CHANGELOG.md](../../../CHANGELOG.md) and the list the application shows under
**What's new** (`ui/src/features/whats-new/changelog.json`) from it. Never edit either
output by hand, and never commit them in a feature pull request: the list is not tracked
(`npm run changelog` writes it before dev, build, typecheck, test and knip), and
CHANGELOG.md changes only when a release is cut. Each change adds its own file, so parallel
branches do not conflict.

## 1. Decide whether an entry is needed

Add an entry when someone outside the code can observe the change:

- people using the application: a screen, field, label, action, rule, message, default or
  workflow behaves differently, or something was added or removed;
- whoever installs or connects it: settings, database migrations, file names and formats,
  interface messages, dependencies that ship in the application, installer or upgrade
  steps, licensing.

No entry for refactors, tests, CI, agent instructions, internal documentation, or changes
only to the presentation website or roadmap. Bundled help (`docs/help/`) that only follows
a change shares that change's entry. When a pull request has nothing observable, say so in
its description and add the `no-changelog` label; the `changelog` workflow then passes.

One entry per observable change. A pull request with several unrelated changes gets one
entry each; a follow-up to an unreleased entry updates that entry instead of adding one.

## 2. Write the file

Name it `changelog.d/YYYY-MM-DD-short-slug.md` (lowercase letters, digits and hyphens):

```markdown
---
date: 2026-11-17
type: added
impact: high
title: Reject a lot in quarantine with a signed record
area: Laboratory setup
link: /setup/material
pr: 145
---
One to three plain sentences for the people who use the application: what they can do now
or what behaves differently, and where to find it.

## Technical notes

Optional. Migrations, settings, identifiers, dependencies or upgrade steps for whoever
installs or integrates the application.
```

| Key | Rule |
| --- | --- |
| `date` | Required. The day the change merges; for a new change, the day you write the entry. |
| `type` | Required. `added`, `changed`, `fixed`, `removed`, `deprecated` or `security` ([Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)). |
| `impact` | Required. See [rating](#3-rate-the-impact). |
| `title` | Required. Sentence case, no trailing period, written for users. |
| `area` | Optional. The navigation area people know it by, such as Front desk, Bench, Review, Reports, Billing, Quality and audit, Interfaces, Test catalog, Laboratory setup or System. Omit for changes across the whole app. |
| `link` | Optional. The application path of the one screen where the change is found, such as `/orders`. A test fails when it is not a screen route. |
| `pr` | Optional. The pull request number; add it once known. |
| `release` | Never written by hand. The release step stamps it ([cut a release](../../../docs/development/releases.md#cut-a-release)). |

Front matter is flat `key: value` lines: no quotes, lists or nesting. The summary is the
text before `## Technical notes`; `**bold**` and `` `code` `` are the only marks the
application renders.

## 3. Rate the impact

| Impact | When |
| --- | --- |
| `high` | A new capability or workflow; a change to how people work; anything a user or deployer must act on (a migration with a manual step, a renamed file a partner reads, a new required setting); a removal; a security fix |
| `medium` | A noticeable improvement to something that exists: a new column, filter or export, clearer refusals, a smoother step |
| `low` | Small fixes and polish: wording, styling, a corrected edge case |

Rate the effect on the laboratory, not the size of the diff. When unsure between two
levels, ask whether someone would want to be told before their next shift.

## 4. Word it

- Use the application's own labels and laboratory terms, in the calm voice of its copy.
  Say what people can do now and where; leave implementation detail to technical notes.
- Everything is public. No names of other products or vendors (the instruments and data
  formats a feature supports are fine), no customer or personal names, synthetic data only,
  no claims of compliance, validation or clinical readiness, no ticket numbers, and nothing
  about how the work was coordinated or who wrote it.
- Describe the product as it is now; do not narrate earlier internal choices or names.

## 5. Regenerate and check

```bash
python3 scripts/changelog.py --check   # exit 1 when an entry is invalid
npm run changelog                      # write the What's new list (done before build and tests)
```

An invalid entry stops both with a message naming the file and the key. Commit the entry
only. CI runs the check, and the `changelog` workflow fails a pull request that changes
application source without adding an entry.

## 6. Hand edits to CHANGELOG.md

A branch that still edits CHANGELOG.md directly, for example one started before the
generator existed, loses those edits at the next regeneration. Move each bullet into its own
entry file: keep its date, choose the type and impact, and put any technical detail under
`## Technical notes` so nothing is lost. On a merge conflict in CHANGELOG.md, take the
`develop` side. A branch started before the What's new list stopped being tracked can
still show it as a conflict or as a deletion: take the deletion, since `npm run changelog`
writes it.
