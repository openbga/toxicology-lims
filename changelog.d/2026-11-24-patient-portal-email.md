---
date: 2026-11-24
type: added
impact: high
title: Record the patient's email for the patient portal
area: Front desk
link: /patients/register
---
Register patient and each patient's page now have an **Email** field. Entering it means the
patient agrees to see their results in the LIMSiq Patient Portal and to receive result
notifications there; leaving it empty means nothing is sent to the portal. On the patient's
page, **Patient portal** shows the current email, and **Add email** or **Change email**
records or removes it. Earlier addresses stay in the patient's history.

## Technical notes

Identity migration 6 adds `idn_subject_emails`, an append-only history of the email; a row
without an email records its removal. New command `set_subject_email` (`enter_orders`,
audited as `identity.set_email` with only whether an email is present). `register_subject`
accepts an optional `email`, and `get_subject` returns the current one. Nothing is sent to
the portal yet.
