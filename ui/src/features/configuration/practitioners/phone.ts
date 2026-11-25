/** Why the practitioner's phone is required: the patient portal shows it with each result. */
export const PRACTITIONER_PHONE_HELP =
  "Shown to patients in the LIMSiq Patient Portal with each result, so they can call the ordering practitioner. Type the 10 digits; the field formats them as (555) 555-0100.";

const PHONE_DIGITS = 10;

/**
 * Formats the digits typed so far as a US number, (555) 555-0100, and ignores digits after
 * the tenth. A pasted +1 country code is dropped. Deleting a bracket, space or hyphen deletes the digit before it, so the format
 * never stops a deletion.
 */
export function formatPhoneAsTyped(next: string, previous: string): string {
  let digits = next.replace(/^\s*\+1/, "").replace(/\D/g, "");
  if (next.length < previous.length && digits === previous.replace(/\D/g, "")) {
    digits = digits.slice(0, -1);
  }
  digits = digits.slice(0, PHONE_DIGITS);
  if (digits === "") return "";
  if (digits.length < 3) return `(${digits}`;
  const area = `(${digits.slice(0, 3)})`;
  if (digits.length === 3) return area;
  if (digits.length <= 6) return `${area} ${digits.slice(3)}`;
  return `${area} ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** The whole number as the field formats it; the engine accepts this and a wider set. */
export function validatePractitionerPhone(value: string): true | string {
  return (
    /^\(\d{3}\) \d{3}-\d{4}$/.test(value.trim()) ||
    "Wrong phone format. Enter the 10 digits of a phone number such as (555) 555-0100."
  );
}
