import { describe, expect, it } from "vitest";
import { validatePortalEmail } from "./portalEmail";

const REFUSED = "Wrong email format. Enter an email such as name@example.com.";

describe("validatePortalEmail (same rules as the engine)", () => {
  it("accepts blank and ordinary addresses", () => {
    for (const value of [
      "",
      "  ",
      "test.patient@example.com",
      " test+portal@mail.example.co.uk ",
      "o'brien@example.ro",
      "t-p_1@sub-domain.example.org",
    ]) {
      expect(validatePortalEmail(value), value).toBe(true);
    }
  });

  it("refuses addresses that are not in email form", () => {
    for (const value of [
      "no-at-sign",
      "@example.com",
      "name@localhost",
      "name@.com",
      "name@example.",
      "a@b@example.com",
      "first last@example.com",
      "madalina.s@j.o",
      "name@example.c0m",
      "name@exa_mple.com",
      "name@-example.com",
      "name@example..com",
      ".name@example.com",
      "na..me@example.com",
      "name,other@example.com",
    ]) {
      expect(validatePortalEmail(value), value).toBe(REFUSED);
    }
  });

  it("refuses an over-long address", () => {
    expect(validatePortalEmail(`${"a".repeat(250)}@example.com`)).toBe(
      "Use at most 254 characters.",
    );
  });
});
