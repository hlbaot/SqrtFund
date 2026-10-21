import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { issueOrganizerEmailProof, verifyOrganizerEmailProof } from "@/lib/server/organizerEmailProof";
const wallet = "0x1111111111111111111111111111111111111111";
beforeEach(() => vi.stubEnv("OTP_SECRET", "s".repeat(32)));
afterEach(() => vi.unstubAllEnvs());
it("binds proof to the verified contact email and wallet", () => {
  const { emailVerificationToken } = issueOrganizerEmailProof(" Contact@gmail.com ", wallet, 1000);
  expect(verifyOrganizerEmailProof(emailVerificationToken, "contact@gmail.com", wallet, 1001)).toBe(true);
  expect(verifyOrganizerEmailProof(emailVerificationToken, "different@gmail.com", wallet, 1001)).toBe(false);
  expect(verifyOrganizerEmailProof(emailVerificationToken, "contact@gmail.com", `0x${"2".repeat(40)}`, 1001)).toBe(false);
});
it("rejects expired proof at the exact expiry boundary", () => {
  const { emailVerificationToken, expiresAt } = issueOrganizerEmailProof("contact@gmail.com", wallet, 1000);
  expect(verifyOrganizerEmailProof(emailVerificationToken, "contact@gmail.com", wallet, expiresAt - 1)).toBe(true);
  expect(verifyOrganizerEmailProof(emailVerificationToken, "contact@gmail.com", wallet, expiresAt)).toBe(false);
});
it("rejects tampered signatures and forged payloads", () => {
  const { emailVerificationToken } = issueOrganizerEmailProof("contact@gmail.com", wallet);
  const [payload, signature] = emailVerificationToken.split(".");
  expect(verifyOrganizerEmailProof(`${payload}.${"0".repeat(64)}`, "contact@gmail.com", wallet)).toBe(false);
  const forged = Buffer.from(JSON.stringify({ purpose: "organizer-contact-email", email: "changed@gmail.com", wallet, expiresAt: Date.now() + 999999 })).toString("base64url");
  expect(verifyOrganizerEmailProof(`${forged}.${signature}`, "changed@gmail.com", wallet)).toBe(false);
});
it.each([undefined, true, "", "fake", "a.b.c", "x".repeat(3000)])("rejects missing/malformed proof %s", token => {
  expect(verifyOrganizerEmailProof(token, "contact@gmail.com", wallet)).toBe(false);
});
