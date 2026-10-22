import { describe, expect, it } from "vitest";
import { buildVerificationEmail } from "@/lib/verify/emailTemplate";
describe("branded verification email", () => {
  it("preserves a leading-zero code and includes bilingual expiry/instructions and a text alternative", () => {
    const email = buildVerificationEmail("012345");
    expect(email.subject).toBe("Mã xác thực SqrtFund / SqrtFund verification code");
    expect(email.html).toContain(">012345</p>");
    expect(email.text).toContain("012345");
    expect(email.text).toContain("Valid for 1 minute");
    expect(email.html).toContain("VALID FOR 1 MIN");
    expect(email.html).toContain("confirm the wallet transaction");
    expect(email.html).toContain("bỏ qua email này");
  });
  it.each(["12345", "1234567", "<img>", "12345\n", "123456\n", "abcdef"])("rejects a malformed or injectable code: %s", code => {
    expect(() => buildVerificationEmail(code)).toThrow("Invalid verification code");
  });
  it("uses the site's dark/red palette with a solid-color fallback and has no remote dependencies", () => {
    const { html } = buildVerificationEmail("654321");
    expect(html).toContain("#0a0a10"); expect(html).toContain('bgcolor="#e84142"');
    expect(html).toContain("linear-gradient"); expect(html).toContain('role="presentation"');
    expect(html).not.toMatch(/<script|<iframe|https?:\/\/|<link/i);
  });
});

it("gives Organizer email the same branded card layout without Student wallet instructions", () => {
  const { html, text } = buildVerificationEmail("038580", "organizer");
  expect(html).toContain("max-width:600px");
  expect(html).toContain("linear-gradient");
  expect(html).toContain("#e84142");
  expect(html).toContain("email liên hệ");
  expect(html).toContain("Platform Owner approval");
  expect(html).not.toContain("confirm the wallet transaction");
  expect(text).toContain("Valid for 1 minute");
});
