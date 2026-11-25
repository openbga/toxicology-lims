---
date: 2026-11-25
type: added
impact: high
title: Record each ordering practitioner's phone
area: Laboratory setup
link: /configuration/practitioners
---
**Register practitioner** and **Correct practitioner** now require a **Phone**, which the
LIMSiq Patient Portal will show to patients with each result. Type the 10 digits and the
field formats them as (555) 555-0100. Practitioners registered before show a yellow
**Not recorded** badge in the list and a **Phone not recorded** warning with **Add phone**
in their panel; they can still be chosen for orders. The correction history keeps the phone with each revision.

## Technical notes

Identity migration 7 adds `idn_practitioners.phone` and `idn_directory_history.phone` and
recreates the practitioner versioning trigger to match it. `register_practitioner` and
`update_practitioner` require `phone` (digits with spaces and `+ - ( ) .`, 7 to 15 digits,
at most 40 characters; the screens send only the 10-digit US form); `PractitionerView` and the history snapshot return it. The demo
data's fictitious practitioners have `(555) 555-01xx` numbers.
