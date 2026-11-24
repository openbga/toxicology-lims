/**
 * The patient's email for the LIMSiq Patient Portal. A filled email is the patient's consent to
 * portal delivery; without one nothing is sent there.
 */
export const PORTAL_EMAIL_CONSENT =
  "Entering the patient's email means the patient agrees to see their results in the LIMSiq Patient Portal and to receive result notifications there. Leave it empty if the patient does not agree: nothing is sent to the portal. For a minor, use the parent's or guardian's email.";

/** Shown instead of an email when the patient has none. */
export const NO_PORTAL_EMAIL = "None. Nothing is sent to the patient portal.";

/** The engine's shape check, so a typo is caught before the patient is registered. */
export function validatePortalEmail(value: string): true | string {
  const email = value.trim();
  if (email === "") return true;
  if (email.length > 254) return "Use at most 254 characters.";
  const at = email.indexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const wellFormed =
    at > 0 &&
    local.length > 0 &&
    !domain.includes("@") &&
    domain.includes(".") &&
    !domain.startsWith(".") &&
    !domain.endsWith(".") &&
    !/\s/.test(email);
  return wellFormed || "Enter an email such as name@example.com.";
}
