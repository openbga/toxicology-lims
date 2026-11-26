---
date: 2026-11-25
type: added
impact: high
title: Send results to the LIMSiq Patient Portal
area: Interfaces
link: /interfaces/connections
---
An HL7 Results connection can now send each released result to the **LIMSiq Patient
Portal** over HTTPS. Enter the ingest address, laboratory code, API user and API token that
LIMSiq gives the laboratory; the token is kept sealed and never shown again. The address
must be https://, except http://localhost for a test portal on this computer. A result waits
while the patient has no email, which is their consent to the portal, or the ordering
practitioner has no phone, and goes once they are added. **Test connection** checks the
address and token without filing anything in the portal. **Send test message** is not
offered for the portal, which would file it as a patient's results.

## Technical notes

New protocol `portal_https`; interfaces migration 19 rebuilds `ifc_partner_connections` with
a `portal` column (address, laboratory code and API user as JSON); the token is sealed in
the column that keeps an SFTP password. Each message is posted to
`{address}/api/labs/{code}/ingest` with HTTP Basic, `{"payload": {"hl7": …}}` and the delivery
ID as `Idempotency-Key`, in the portal profile of the ORU^R01 with the revision's PDF. 202 and
200 are recorded as AA, 413 and 422 as AR with the portal's reason; 401, 403, 429, 5xx and
network problems are retried. New wait reasons `no_portal_email` and
`no_practitioner_phone`. `reqwest` and `rustls` come from the updater's tree: no new crate.
