import { describe, expect, it } from "vitest";
import { allowedDomains, emailDomainPolicy, emailDomain, isAllowedEmail, maskEmail, normalizeEmail } from "@/lib/verify/domain";
import { consumeError, equalHashes, forwardedIp, generateOtp, hashOtp, hashValue } from "@/lib/verify/otp";
const secret = "test-secret-used-only-in-tests-32-characters";
describe("academic email validation", () => {
  it.each(["a@hust.edu.vn", " A@HUST.EDU.VN ", "ab@student.hcmus.edu.vn", "a@mit.edu"])("accepts %s", email => expect(isAllowedEmail(email, "hust.edu.vn,hcmus.edu.vn,mit.edu")).toBe(true));
  it.each(["a@hust.edu.vn.evil.com", "a@evil.com", "a@@hust.edu.vn", "a b@hust.edu.vn", "a@-foo.edu.vn", "a@foo..edu.vn", ".a@hust.edu.vn", "a..b@hust.edu.vn", "a@edu.vn", "@hust.edu.vn", "a@foo.edu.vn\nBcc:evil@foo.edu.vn"])("rejects %s", email => expect(isAllowedEmail(email, "hust.edu.vn,hcmus.edu.vn,mit.edu")).toBe(false));
  it("matches explicit domains and their subdomains at a label boundary", () => {
    expect(isAllowedEmail("a@student.hcmus.edu.vn", "hust.edu.vn, HCMUS.edu.vn")).toBe(true);
    expect(isAllowedEmail("a@evilhcmus.edu.vn", ["hcmus.edu.vn"])).toBe(false);
    expect(isAllowedEmail("a@mit.edu", ["hust.edu.vn"])).toBe(false);
    expect(allowedDomains(" HUST.EDU.VN, ,mit.edu")).toEqual(["hust.edu.vn", "mit.edu"]);
    expect(normalizeEmail(" A@HUST.EDU.VN ")).toBe("a@hust.edu.vn");
    expect(isAllowedEmail("a@mit.edu", "")).toBe(true);
    expect(normalizeEmail(" A+TAG@HUST.EDU.VN ")).toBe("a@hust.edu.vn");
    expect(isAllowedEmail("a..b+tag@hust.edu.vn", "hust.edu.vn")).toBe(false);
    expect(emailDomain("broken")).toBeNull();
    expect(maskEmail("abc@hust.edu.vn")).toBe("ab***@hust.edu.vn");
  });
});
describe("optional domain policy", () => {
  it.each([undefined, "", "   "])("defaults to open-edu for %s", domains => {
    expect(emailDomainPolicy(domains)).toEqual({ mode: "open-edu", allowedDomains: [], blockedDomains: [] });
    for (const email of ["a@hust.edu.vn", "a@student.hcmus.edu.vn", "a@mit.edu", " A+TAG@STUDENT.HCMUS.EDU.VN "]) expect(isAllowedEmail(email, domains)).toBe(true);
    expect(isAllowedEmail("a@ox.ac.uk", domains)).toBe(false);
  });
  it.each(["a@b.edu.vn.evil.com", "a@evil.com", "a@edu.vn", "a@.edu.vn", "a@edu", "hust.edu.vn", "a@@hust.edu.vn", "a b@hust.edu.vn", "a@hust .edu.vn", "a@hust.edu.vn evil.com", "a@foo.edu.vn\nBcc:evil@foo.edu.vn"])("rejects forged/malformed open-mode email %s", email => {
    expect(isAllowedEmail(email)).toBe(false);
  });
  it("switches to an explicit allowlist including non-edu schools", () => {
    const allowed = " HUST.EDU.VN, OX.AC.UK , ";
    expect(emailDomainPolicy(allowed).mode).toBe("allowlist");
    expect(isAllowedEmail(" A@STUDENT.OX.AC.UK ", allowed)).toBe(true);
    expect(isAllowedEmail("a@ox.ac.uk", allowed)).toBe(true);
    expect(isAllowedEmail("a@mit.edu", allowed)).toBe(false);
    expect(isAllowedEmail("a@evilox.ac.uk", allowed)).toBe(false);
    expect(isAllowedEmail("a@ox.ac.uk.evil.com", allowed)).toBe(false);
    expect(isAllowedEmail("a@edu.vn", "edu.vn")).toBe(false);
  });
  it.each(["", "hust.edu.vn,mit.edu"])("blocklist overrides policy %s and covers subdomains", allowed => {
    const blocked = " HUST.EDU.VN , fake.edu.vn ";
    expect(isAllowedEmail("a@hust.edu.vn", allowed, blocked)).toBe(false);
    expect(isAllowedEmail("a@student.hust.edu.vn", allowed, blocked)).toBe(false);
    expect(isAllowedEmail("a@mit.edu", allowed, blocked)).toBe(true);
    expect(isAllowedEmail("a@evilhust.edu.vn", "", blocked)).toBe(true);
    expect(emailDomainPolicy(allowed, blocked).blockedDomains).toEqual(["hust.edu.vn", "fake.edu.vn"]);
  });
  it("normalizes array domain lists as well as raw env strings", () => {
    expect(isAllowedEmail("a@ox.ac.uk", [" OX.AC.UK "])).toBe(true);
    expect(isAllowedEmail("a@ox.ac.uk", [" OX.AC.UK "], [" OX.AC.UK "])).toBe(false);
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
