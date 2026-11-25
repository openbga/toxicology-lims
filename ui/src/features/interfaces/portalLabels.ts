// Laboratory wording for LIMSiq Patient Portal connections (#4672): the ingest address the
// LIS posts HL7 results to and the portal's problems. Codes come from the engine and carry no
// patient data; the portal's acceptance means it took the message, not that a patient saw it.

/** Why a post to the portal, or its Test connection, failed. */
export const PORTAL_PROBLEMS: Record<string, string> = {
  not_https: "The portal's address is not https://; patient data is never sent unencrypted",
  portal_unauthorized:
    "The portal refused the API user or token; check them with LIMSiq and enter the token again",
  portal_unreachable: "The portal did not answer; check the ingest address and the internet",
  portal_unavailable: "The portal is unavailable for now",
  portal_busy: "The portal is busy and asked the LIS to wait",
  token_unreadable: "The saved API token cannot be read on this computer; enter it again",
};
