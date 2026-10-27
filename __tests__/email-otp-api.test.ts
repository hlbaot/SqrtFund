// Wallet cryptography and endpoint rejection are covered in email-wallet-authorization.test.ts.
vi.mock("@/lib/server/emailWalletAuthorization", () => ({ authorizeEmailWallet: vi.fn().mockResolvedValue(undefined) }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), reserve: vi.fn(), send: vi.fn(), validate: vi.fn(), sign: vi.fn(),
  results: [] as { data: unknown; error: null | { code: string } }[],
  operations: [] as { table: string; method: string; value: unknown }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({ ensureEmailWallet: vi.fn().mockResolvedValue(`0x${"a".repeat(64)}`) }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from: f.from, rpc: f.rpc }) }));
vi.mock("@/lib/verify/rateLimit", () => ({ reserveOtp: f.reserve }));
vi.mock("@/lib/verify/mailer", () => ({ sendOtp: f.send }));
vi.mock("@/lib/verify/signer", () => ({ validateRegistry: f.validate, signVerification: f.sign }));
import { GET as domainConfig, POST as requestOtp } from "@/app/api/verify/request-otp/route";
import { POST as confirm } from "@/app/api/verify/confirm/route";
import { VerificationError } from "@/lib/verify/errors";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { hashOtp } from "@/lib/verify/otp";
const address = "0x1111111111111111111111111111111111111111";
const registry = "0x2222222222222222222222222222222222222222";
const emailHash = `0x${"a".repeat(64)}` as const;
const id = "12345678-1234-1234-1234-123456789abc";
const row = { email: "a@hust.edu.vn", address, registry_address: registry, email_hash: emailHash, email_domain: "hust.edu.vn" };
function req(body: unknown) { return new Request("https://sqrt.test/api/verify", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.1, 127.0.0.1" }, body: JSON.stringify(body) }); }
function result(data: unknown = null, error: null | { code: string } = null) { f.results.push({ data, error }); }
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(ensureEmailWallet).mockResolvedValue(emailHash); vi.spyOn(console, "error").mockImplementation(() => {}); f.results.length = 0; f.operations.length = 0;
  vi.stubEnv("OTP_SECRET", "unit-tests-only-secret-at-least-32-chars"); vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "hust.edu.vn");

  vi.stubEnv("ATTESTER_PRIVATE_KEY", `0x${"11".repeat(32)}`);
  vi.stubEnv("NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS", registry);
  vi.stubEnv("SUPABASE_URL", "https://fixture.supabase.co"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-role");
  vi.stubEnv("EMAIL_PROVIDER", "smtp"); vi.stubEnv("SMTP_HOST", "smtp.gmail.com"); vi.stubEnv("SMTP_PORT", "587");
  vi.stubEnv("SMTP_USER", "fixture@gmail.com"); vi.stubEnv("SMTP_FROM", "SqrtFund <fixture@gmail.com>"); vi.stubEnv("SMTP_PASS", "abcdefghijklmnop");
  vi.stubEnv("BLOCKED_EMAIL_DOMAINS", "");
  f.from.mockImplementation((table: string) => {
    const builder = {
      update: (value: unknown) => { f.operations.push({ table, method: "update", value }); return { eq: async () => ({ error: null }) }; },
      select: (value: unknown) => { f.operations.push({ table, method: "select", value }); return builder; },
      eq: () => builder, lt: () => builder,
      delete: () => { f.operations.push({ table, method: "delete", value: null }); return builder; },
      upsert: (value: unknown) => { f.operations.push({ table, method: "upsert", value }); return builder; },
      maybeSingle: async () => f.results.shift(), single: async () => f.results.shift(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(f.results.shift()).then(resolve),
    }; return builder;
  });
  f.reserve.mockResolvedValue({ status: "OK", expiresAt: "2030-01-01T00:10:00Z" });
  f.send.mockResolvedValue(undefined); f.validate.mockResolvedValue(registry); f.sign.mockResolvedValue("0xsignature");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("request OTP boundary", () => {
  it("requests a global OTP without any factory or round in the body", async () => {
    result(); result();
    const response = await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect(response.status).toBe(200); expect(f.validate).toHaveBeenCalledWith();
    const stored = f.reserve.mock.calls[0][1]; expect(stored.registry_address).toBe(registry);
    const data = await response.json();
    expect(Date.parse(data.expiresAt) - Date.now()).toBeGreaterThan(299_000);
    expect(Date.parse(data.expiresAt) - Date.now()).toBeLessThanOrEqual(300_000);
    expect(f.operations).toContainEqual({ table: "otp_requests", method: "update", value: { expires_at: data.expiresAt } });
  });
  it.each([undefined, "", "   "])("does not send OTP or sign when domain policy is missing: %s", async domains => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", domains);
    const response = await requestOtp(req({ email: "a@student.hcmus.edu.vn", address }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "STUDENT_DOMAIN_POLICY_UNCONFIGURED" });
    expect(f.send).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled();
  });
  it.each([undefined, ""])("exposes an unconfigured policy without opening verification: %s", async domains => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", domains);
    const response = await domainConfig(); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mode: "unconfigured", allowedDomains: [], blockedDomains: [] });
    expect(f.from).not.toHaveBeenCalled(); expect(f.validate).not.toHaveBeenCalled();
  });
  it("exposes normalized allowlist and blocklist for the shared UI validator", async () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", " HUST.EDU.VN, ox.ac.uk ");
    vi.stubEnv("BLOCKED_EMAIL_DOMAINS", " STUDENT.HUST.EDU.VN ");
    expect(await (await domainConfig()).json()).toEqual({ mode: "allowlist", allowedDomains: ["hust.edu.vn", "ox.ac.uk"], blockedDomains: ["student.hust.edu.vn"] });
  });
  it.each(["student.hust.edu.vn", "hust.edu.vn,student.hust.edu.vn"])("rejects blocked domains before RPC, database or mail (%s)", async domains => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", domains); vi.stubEnv("BLOCKED_EMAIL_DOMAINS", " HUST.EDU.VN ");
    const response = await requestOtp(req({ email: "a@student.hust.edu.vn", address }));
    expect((await response.json()).code).toBe("INVALID_DOMAIN"); expect(f.validate).not.toHaveBeenCalled(); expect(f.from).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
  });
  it("accepts a non-edu school only through explicit allowlisting", async () => {
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "hust.edu.vn");
    expect((await (await requestOtp(req({ email: "a@ox.ac.uk", address }))).json()).code).toBe("INVALID_DOMAIN");
    vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "ox.ac.uk"); result(); result();
    expect((await requestOtp(req({ email: "a@ox.ac.uk", address }))).status).toBe(200);
  });
  it("resumes a verified identity without sending another email", async () => {
    result({ address }); result(); f.reserve.mockResolvedValue({ status: "ALREADY_VERIFIED" });
    const response = await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect(response.status).toBe(200); expect((await response.json()).code).toBe("ALREADY_VERIFIED");
    expect(f.send).not.toHaveBeenCalled(); expect(f.sign).toHaveBeenCalledOnce();
  });
  it("reports missing variable names without configuration values", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const response = await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ code: "CONFIG_MISSING", missing: ["SUPABASE_SERVICE_ROLE_KEY"] });
    expect(f.from).not.toHaveBeenCalled();
  });
  it("distinguishes a missing schema from general service failures", async () => {
    result(null, { code: "42P01" });
    const response = await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect((await response.json()).code).toBe("DB_SCHEMA_MISMATCH"); expect(f.send).not.toHaveBeenCalled();
  });
  it("canonicalizes aliases for identity while preserving the delivery address", async () => {
    result(); result(); await requestOtp(req({ email: " A+TAG@HUST.EDU.VN ", address }));
    const firstHash = f.reserve.mock.calls[0][1].email_hash;
    expect(f.send.mock.calls[0][0]).toBe("a+tag@hust.edu.vn");
    result(); result(); await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect(f.reserve.mock.calls[1][1].email_hash).toBe(firstHash);
  });
  it("does not log a delivered code or raw email in production", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production"); result(); result();
    const response = await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect(response.status).toBe(200); expect(f.send).toHaveBeenCalledOnce(); expect(log).not.toHaveBeenCalled();
  });
  it("rejects invalid domains before database access", async () => {
    const response = await requestOtp(req({ email: "a@hust.edu.vn.evil.com", address }));
    expect((await response.json()).code).toBe("INVALID_DOMAIN"); expect(f.from).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
  });
  it("rejects invalid addresses and cross-origin requests", async () => {
    expect((await requestOtp(req({ email: "a@hust.edu.vn", address: "invalid" }))).status).toBe(400);
    const request = req({}); request.headers.set("origin", "https://evil.test");
    expect((await requestOtp(request)).status).toBe(400); expect(f.send).not.toHaveBeenCalled();
  });
  it("refuses an email owned by a different wallet before sending", async () => {
    result({ address: registry });
    expect((await requestOtp(req({ email: "a@hust.edu.vn", address }))).status).toBe(409);
    expect(f.send).not.toHaveBeenCalled();
  });
  it("returns only request metadata, stores only hashes, and delivers a random code", async () => {
    result(); result();
    const response = await requestOtp(req({ email: " AB@HUST.EDU.VN ", address }));
    const body = await response.json(); expect(Object.keys(body).sort()).toEqual(["expiresAt", "requestId", "resendAfter"]);
    const [email, otp] = f.send.mock.calls[0]; expect(email).toBe("ab@hust.edu.vn"); expect(otp).toMatch(/^\d{6}$/);
    const stored = f.reserve.mock.calls[0][1]; expect(stored.otp_hash).toBe(hashOtp(body.requestId, otp));
    expect(JSON.stringify(stored)).not.toContain(email); expect(stored.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toHaveProperty("email"); expect(stored).not.toHaveProperty("otp");
  });
  it("returns 429 and retry-after without sending mail", async () => {
    result(); result(); f.reserve.mockResolvedValue({ status: "RATE_LIMITED", retryAfter: 42 });
    const response = await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("42"); expect(f.send).not.toHaveBeenCalled();
  });
  it("deletes the new request when delivery fails and returns a safe error", async () => {
    result(); result(); result(); f.send.mockRejectedValue(new Error("sensitive mail provider error"));
    const response = await requestOtp(req({ email: "a@hust.edu.vn", address }));
    expect((await response.json()).code).toBe("EMAIL_SEND_FAILED");
    expect(f.operations.filter(op => op.method === "delete")).toHaveLength(2);
  });
});
describe("confirm boundary", () => {
  it("refuses a code issued for another registry before consuming it", async () => {
    result({ ...row, registry_address: address });
    const response = await confirm(req({ requestId: id, otp: "012345" }));
    expect((await response.json()).code).toBe("REGISTRY_CHANGED");
    expect(f.rpc).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
  });
  it.each(["REGISTRY_UNAVAILABLE", "CONFIG_MISSING"])("preserves %s from confirmation without signing", async code => {
    result(row); f.rpc.mockResolvedValue({ data: { status: "OK" }, error: null });
    f.validate.mockRejectedValue(new VerificationError(code));
    const response = await confirm(req({ requestId: id, otp: "012345" }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe(code); expect(f.sign).not.toHaveBeenCalled();
    expect(f.operations.some(op => op.method === "upsert")).toBe(false);
  });
  it.each([["WRONG", "OTP_WRONG"], ["LOCKED", "OTP_LOCKED"], ["EXPIRED", "OTP_EXPIRED"]])("maps %s without signing", async (status, code) => {
    result(row); f.rpc.mockResolvedValue({ data: { status, attemptsLeft: 3 }, error: null });
    const response = await confirm(req({ requestId: id, otp: "012345" }));
    expect((await response.json()).code).toBe(code); expect(f.sign).not.toHaveBeenCalled();
  });
  it("releases a signature only after the database records the same owner", async () => {
    result(row); result(); result({ address }); f.rpc.mockResolvedValue({ data: { status: "OK" }, error: null });
    const response = await confirm(req({ requestId: id, otp: "012345", address: registry }));
    const body = await response.json(); expect(body.signature).toBe("0xsignature"); expect(body.emailHash).toBe(emailHash);
    expect(f.sign.mock.calls[0].slice(0, 2)).toEqual([address, emailHash]);
    expect(body.registryAddress).toBe(registry); expect(body.chainId).toBe(43113);
    expect(BigInt(body.expiry)).toBeGreaterThan(BigInt(Math.floor(Date.now() / 1000) + 3500));
  });
  it("never returns a signature when a concurrent verification owns the email", async () => {
    result(row); result(); result({ address: registry }); f.rpc.mockResolvedValue({ data: { status: "OK" }, error: null });
    const response = await confirm(req({ requestId: id, otp: "012345" }));
    const body = await response.json(); expect(body.code).toBe("EMAIL_ALREADY_USED"); expect(body).not.toHaveProperty("signature");
  });
  it("does not reserve a verification if signing fails after consumption", async () => {
    result(row); f.rpc.mockResolvedValue({ data: { status: "OK" }, error: null }); f.sign.mockRejectedValue(new Error("private configuration detail"));
    const response = await confirm(req({ requestId: id, otp: "012345" }));
    expect((await response.json()).code).toBe("SERVICE_UNAVAILABLE"); expect(f.operations.some(op => op.method === "upsert")).toBe(false);
  });
  it("rejects malformed request ids and codes without database access", async () => {
    expect((await confirm(req({ requestId: "bad", otp: "012345" }))).status).toBe(400);
    expect((await confirm(req({ requestId: id, otp: "not-a-code" }))).status).toBe(400); expect(f.rpc).not.toHaveBeenCalled();
  });
});

it("blocks Student registration if the email belongs to a different Organizer wallet", async () => {
  vi.mocked(ensureEmailWallet).mockRejectedValueOnce(new VerificationError("EMAIL_ALREADY_USED",409));
  const response=await requestOtp(req({email:"a@hust.edu.vn",address}));
  expect(response.status).toBe(409); expect(f.send).not.toHaveBeenCalled();
});
it("never releases a Student signature if a competing wallet claimed the email", async () => {
  result(row); f.rpc.mockResolvedValue({data:{status:"OK"},error:null});
  vi.mocked(ensureEmailWallet).mockRejectedValueOnce(new VerificationError("EMAIL_ALREADY_USED",409));
  const response=await confirm(req({requestId:id,otp:"123456"}));
  expect(response.status).toBe(409); expect(await response.json()).not.toHaveProperty("signature");
});

it("persists the canonical plain email before delivering the OTP", async () => {
  result(); result();
  await requestOtp(req({ email: " A+TAG@HUST.EDU.VN ", address }));
  expect(ensureEmailWallet).toHaveBeenCalledWith("a@hust.edu.vn", address, false, expect.anything());
  expect(f.operations).toContainEqual({ table: "otp_requests", method: "update", value: { email: "a@hust.edu.vn" } });
  expect(f.reserve.mock.calls[0][1].email_hash).toBe(emailHash);
});
it("requires a fresh OTP for legacy challenges without a stored email", async () => {
  result({ ...row, email: null });
  const response = await confirm(req({ requestId: id, otp: "123456" }));
  expect(await response.json()).toMatchObject({ code: "OTP_EXPIRED" });
  expect(f.sign).not.toHaveBeenCalled();
});
it("does not sign a challenge whose ID differs from its email binding", async () => {
  result(row); f.rpc.mockResolvedValue({ data: { status: "OK" }, error: null });
  vi.mocked(ensureEmailWallet).mockResolvedValueOnce(`0x${"b".repeat(64)}`);
  const response = await confirm(req({ requestId: id, otp: "123456" }));
  expect(response.status).toBe(503); expect(f.sign).not.toHaveBeenCalled();
});

it("rejects unapproved edu mail before signature, RPC, storage or delivery", async () => {
  const response = await requestOtp(req({ email: "fixture@untrusted-school.edu.vn", address }));
  expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ code: "INVALID_DOMAIN" });
  expect(f.from).not.toHaveBeenCalled(); expect(f.reserve).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
});
it("rechecks current policy at confirm before consuming a previously issued OTP", async () => {
  result({ ...row, email: "fixture@untrusted-school.edu.vn", email_domain: "untrusted-school.edu.vn" });
  const response = await confirm(req({ requestId: id, otp: "123456" }));
  expect(response.status).toBe(400); expect(await response.json()).toMatchObject({ code: "INVALID_DOMAIN" });
  expect(f.rpc).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled(); expect(ensureEmailWallet).not.toHaveBeenCalled();
});
it("does not resume a previously verified identity when its domain is no longer approved", async () => {
  f.reserve.mockResolvedValue({ status: "ALREADY_VERIFIED" });
  const response = await requestOtp(req({ email: "fixture@untrusted-school.edu.vn", address }));
  expect(response.status).toBe(400); expect(f.reserve).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
});
it("does not confirm an old OTP if trusted-domain configuration is removed", async () => {
  result(row); vi.stubEnv("ALLOWED_EMAIL_DOMAINS", "");
  const response = await confirm(req({ requestId: id, otp: "123456" }));
  expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ code: "STUDENT_DOMAIN_POLICY_UNCONFIGURED" });
  expect(f.rpc).not.toHaveBeenCalled(); expect(f.sign).not.toHaveBeenCalled();
});
