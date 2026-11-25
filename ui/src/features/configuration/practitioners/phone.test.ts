import { describe, expect, it } from "vitest";
import { formatPhoneAsTyped, validatePractitionerPhone } from "./phone";

const REFUSED = "Wrong phone format. Enter the 10 digits of a phone number such as (555) 555-0100.";

/** Types the keys one by one, as the field receives them. */
function typed(keys: string): string {
  let value = "";
  for (const key of keys) value = formatPhoneAsTyped(value + key, value);
  return value;
}

describe("formatPhoneAsTyped", () => {
  it("formats the digits while they are typed", () => {
    expect(typed("7")).toBe("(7");
    expect(typed("77")).toBe("(77");
    expect(typed("777")).toBe("(777)");
    expect(typed("7775")).toBe("(777) 5");
    expect(typed("777555")).toBe("(777) 555");
    expect(typed("7775550")).toBe("(777) 555-0");
    expect(typed("5555550100")).toBe("(555) 555-0100");
  });

  it("ignores digits after the tenth and anything that is not a digit", () => {
    expect(typed("55555501001")).toBe("(555) 555-0100");
    expect(typed("a5b5c5")).toBe("(555)");
  });

  it("formats a pasted number", () => {
    expect(formatPhoneAsTyped("+1 555.555.0100", "")).toBe("(555) 555-0100");
    expect(formatPhoneAsTyped("555-555-0100", "")).toBe("(555) 555-0100");
  });

  it("deletes the digit before a bracket, space or hyphen", () => {
    expect(formatPhoneAsTyped("(777", "(777)")).toBe("(77");
    expect(formatPhoneAsTyped("(777)5", "(777) 5")).toBe("(777)");
    expect(formatPhoneAsTyped("(777) 5550", "(777) 555-0")).toBe("(777) 555");
    expect(formatPhoneAsTyped("(", "(7")).toBe("");
  });
});

describe("validatePractitionerPhone", () => {
  it("accepts a complete number", () => {
    expect(validatePractitionerPhone("(555) 555-0100")).toBe(true);
  });

  it("refuses an incomplete number or text", () => {
    for (const phone of ["(555) 55", "(555)", "call the clinic", "5555550100"]) {
      expect(validatePractitionerPhone(phone), phone).toBe(REFUSED);
    }
  });
});
