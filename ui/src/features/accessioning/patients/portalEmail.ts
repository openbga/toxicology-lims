/**
 * The patient's email for the LIMSiq Patient Portal. A filled email is the patient's consent to
 * portal delivery; without one nothing is sent there.
 */
export const PORTAL_EMAIL_CONSENT =
  "Entering the patient's email means the patient agrees to see their results in the LIMSiq Patient Portal and to receive result notifications there. Leave it empty if the patient does not agree: nothing is sent to the portal. For a minor, use the parent's or guardian's email.";

/** Shown instead of an email when the patient has none. */
export const NO_PORTAL_EMAIL = "None. Nothing is sent to the patient portal.";

/** The part before `@`: allowed characters, no dot at either end, no two dots together. */
const LOCAL = /^(?!\.)(?!.*\.\.)[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}(?<!\.)$/;
/** One domain label: letters, digits and inner hyphens, 1 to 63 long. */
const LABEL = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;
/** The top-level domain: at least two letters. */
const TLD = /^[A-Za-z]{2,}$/;

/** The engine's shape check, so a typo is caught before it is sent. */
export function validatePortalEmail(value: string): true | string {
  const email = value.trim();
  if (email === "") return true;
  if (email.length > 254) return "Use at most 254 characters.";
  const at = email.indexOf("@");
  const labels = email.slice(at + 1).split(".");
  const wellFormed =
    at > 0 &&
    LOCAL.test(email.slice(0, at)) &&
    labels.length >= 2 &&
    labels.every((label) => LABEL.test(label)) &&
    TLD.test(labels.at(-1) ?? "");
  return wellFormed || "Wrong email format. Enter an email such as name@example.com.";
}
