import { describe, expect, it } from "vitest";
import { allowedDomains, emailDomainPolicy, emailDomain, isAllowedEmail, maskEmail, normalizeEmail } from "@/lib/verify/domain";
import { consumeError, equalHashes, forwardedIp, generateOtp, hashOtp, hashValue } from "@/lib/verify/otp";
const secret = "test-secret-used-only-in-tests-32-characters";
describe("approved academic email policy", () => {
  const approved = "hust.edu.vn,student.hcmus.edu.vn,mit.edu";
  it.each(["a@hust.edu.vn", " A@HUST.EDU.VN ", "ab@student.hcmus.edu.vn", "a@mit.edu"])("accepts explicitly approved domain: %s", email => {
    expect(isAllowedEmail(email, approved)).toBe(true);
  });
  it.each(["a@untrusted-school.edu.vn", "a@untrusted-school.edu", "a@hust.edu.vn.evil.com", "a@evil.com", "a@@hust.edu.vn", "a b@hust.edu.vn", "a@-foo.edu.vn", "a@foo..edu.vn", ".a@hust.edu.vn", "a..b@hust.edu.vn", "a@edu.vn", "@hust.edu.vn", "a@foo.edu.vn\nBcc:evil@foo.edu.vn"])("rejects unapproved or malformed email: %s", email => {
    expect(isAllowedEmail(email, approved)).toBe(false);
  });
  it("requires subdomains to be explicitly approved", () => {
    expect(isAllowedEmail("a@student.hcmus.edu.vn", "hcmus.edu.vn")).toBe(false);
    expect(isAllowedEmail("a@student.hcmus.edu.vn", "student.hcmus.edu.vn")).toBe(true);
    expect(isAllowedEmail("a@evilhcmus.edu.vn", "hcmus.edu.vn")).toBe(false);
  });
  it.each(["*.edu.vn", "edu.vn", "school.edu.vn,broken domain", "school.edu.vn,https://other.edu.vn"])("disables verification when explicit policy is invalid: %s", domains => {
    expect(emailDomainPolicy(domains).mode).toBe("unconfigured");
    for (const email of ["a@hust.edu.vn", "a@student.hcmus.edu.vn", "a@mit.edu", "a@untrusted-school.edu.vn"]) {
      expect(isAllowedEmail(email, domains)).toBe(false);
    }
  });
  it.each([undefined, "", "   "])("uses open-edu when no allowlist is configured: %s", domains => {
    expect(emailDomainPolicy(domains).mode).toBe("open-edu");
    for (const email of ["a@school.edu.vn", "a@school.edu", "a@student.school.edu.vn"]) expect(isAllowedEmail(email, domains)).toBe(true);
    for (const email of ["a@edu.vn", "a@gmail.com", "a@school.edu.vn.evil.com", "a@evil-edu.vn", "a@school..edu.vn", "a@@school.edu.vn"]) expect(isAllowedEmail(email, domains)).toBe(false);
    expect(isAllowedEmail("a@student.blocked.edu.vn", domains, "blocked.edu.vn")).toBe(false);
  });
  it("accepts non-edu schools only when their exact domain is approved", () => {
    expect(isAllowedEmail("a@ox.ac.uk", "ox.ac.uk")).toBe(true);
    expect(isAllowedEmail("a@student.ox.ac.uk", "ox.ac.uk")).toBe(false);
    expect(isAllowedEmail("a@student.ox.ac.uk", "student.ox.ac.uk")).toBe(true);
  });
  it("blocklist denies a domain and its children even when explicitly allowed", () => {
    const allowed = "hust.edu.vn,student.hust.edu.vn,mit.edu";
    const blocked = " HUST.EDU.VN , fake.edu.vn ";
    expect(isAllowedEmail("a@hust.edu.vn", allowed, blocked)).toBe(false);
    expect(isAllowedEmail("a@student.hust.edu.vn", allowed, blocked)).toBe(false);
    expect(isAllowedEmail("a@mit.edu", allowed, blocked)).toBe(true);
    expect(emailDomainPolicy(allowed, blocked).blockedDomains).toEqual(["hust.edu.vn", "fake.edu.vn"]);
  });
  it("keeps email normalization and env/array normalization consistent", () => {
    expect(allowedDomains(" HUST.EDU.VN, ,mit.edu")).toEqual(["hust.edu.vn", "mit.edu"]);
    expect(isAllowedEmail("a@ox.ac.uk", [" OX.AC.UK "])).toBe(true);
    expect(isAllowedEmail("a@ox.ac.uk", [" OX.AC.UK "], [" OX.AC.UK "])).toBe(false);
    expect(normalizeEmail(" A+TAG@HUST.EDU.VN ")).toBe("a@hust.edu.vn");
    expect(isAllowedEmail("a..b+tag@hust.edu.vn", "hust.edu.vn")).toBe(false);
    expect(emailDomain("broken")).toBeNull();
    expect(maskEmail("abc@hust.edu.vn")).toBe("ab***@hust.edu.vn");
  });
});
describe("OTP security helpers", () => {
  it("generates six numeric digits including leading zero support", () => {
    const codes = Array.from({ length: 100 }, generateOtp);
    expect(codes.every(code => /^\d{6}$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(1);
  });
  it("binds HMAC to request, purpose and secret", () => {
    const hash = hashOtp("id", "012345", secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(equalHashes(hash, hashOtp("id", "012345", secret))).toBe(true);
    expect(equalHashes(hash, hashOtp("other", "012345", secret))).toBe(false);
    expect(equalHashes(hash, hashOtp("id", "012345", secret + "other"))).toBe(false);
    expect(equalHashes(hash, hashValue("id:012345", "ip", secret))).toBe(false);
    expect(equalHashes(hash, "bad")).toBe(false);
    expect(equalHashes("", "")).toBe(false);
    expect(() => hashOtp("id", "012345", "short")).toThrow();
  });
  it.each([[" 203.0.113.1, 10.0.0.1", "203.0.113.1"], ["2001:db8::1", "2001:db8::1"], ["invalid, 203.0.113.1", "unknown"], ["", "unknown"]])("parses first forwarded IP %s", (value, expected) => {
    expect(forwardedIp(new Headers({ "x-forwarded-for": value }))).toBe(expected);
  });
  it("maps every atomic consumption outcome", () => {
    expect(consumeError({ status: "OK" })).toBeNull();
    expect(consumeError({ status: "WRONG", attemptsLeft: 4 })).toEqual({ code: "OTP_WRONG", attemptsLeft: 4 });
    expect(consumeError({ status: "LOCKED" })).toEqual({ code: "OTP_LOCKED" });
    expect(consumeError({ status: "EXPIRED" })).toEqual({ code: "OTP_EXPIRED" });
  });
});
