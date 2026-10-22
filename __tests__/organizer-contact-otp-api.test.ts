import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({ ensureEmailWallet: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc: f.rpc, from: () => ({ update: f.update }) }) }));
vi.mock("@/lib/verify/mailer", () => ({ sendOtp: f.send }));
import { POST } from "@/app/api/organizer-applications/email/route";
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { VerificationError } from "@/lib/verify/errors";
import { hashOtp } from "@/lib/verify/otp";
import { verifyOrganizerEmailProof } from "@/lib/server/organizerEmailProof";
const walletAddress = `0x${"1".repeat(40)}`, contactEmail = "contact@gmail.com";
const requestId = "11111111-1111-4111-8111-111111111111";
function post(body: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/organizer-applications/email", { method: "POST", body: JSON.stringify({ walletAddress, contactEmail, ...body }) }));
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const [name, value] of Object.entries({ OTP_SECRET: "x".repeat(32), SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "fixture", EMAIL_PROVIDER: "resend", SMTP_FROM: "fixture@example.test", RESEND_API_KEY: "fixture" })) vi.stubEnv(name, value);
  f.rpc.mockResolvedValue({ data: { status: "OK", expiresAt: "2026-10-21T16:00:00Z" }, error: null });
  f.send.mockResolvedValue(undefined); f.update.mockReturnValue({ eq: f.eq }); f.eq.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("accepts a non-student contact email and sends an Organizer-specific code", async () => {
  const response = await post({ action: "request" });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(Date.parse(data.expiresAt) - Date.now()).toBeGreaterThan(59_000);
  expect(Date.parse(data.expiresAt) - Date.now()).toBeLessThanOrEqual(60_000);
  expect(f.update).toHaveBeenCalledWith({ expires_at: data.expiresAt });
  expect(data.requestId).toBeTruthy(); expect(data).not.toHaveProperty("otp");
  expect(f.send).toHaveBeenCalledWith(contactEmail, expect.stringMatching(/^\d{6}$/), "organizer");
  expect(f.rpc).toHaveBeenCalledWith("reserve_organizer_contact_otp", expect.objectContaining({ p_wallet: walletAddress, p_otp_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
});
it("does not send an email when the database rate limit rejects a request", async () => {
  f.rpc.mockResolvedValue({ data: { status: "RATE_LIMITED", retryAfter: 60 } });
  const response = await post({ action: "request" });
  expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("60"); expect(f.send).not.toHaveBeenCalled();
});
it.each(["WRONG", "LOCKED", "EXPIRED"])("does not issue proof for %s codes", async status => {
  f.rpc.mockResolvedValue({ data: { status } });
  const response = await post({ action: "verify", requestId, otp: "123456" });
  expect(response.status).toBe(400); expect(await response.json()).not.toHaveProperty("emailVerificationToken");
});
it("issues only contact-email proof after consuming a valid OTP", async () => {
  const response = await post({ action: "verify", requestId, otp: "123456" });
  const data = await response.json();
  expect(verifyOrganizerEmailProof(data.emailVerificationToken, contactEmail, walletAddress)).toBe(true);
  expect(f.rpc).toHaveBeenCalledWith("consume_organizer_contact_otp", expect.objectContaining({ p_id: requestId, p_otp_hash: hashOtp(`organizer:${requestId}`, "123456") }));
  expect(data).not.toHaveProperty("signature"); expect(data).not.toHaveProperty("role");
});
it("fails closed when the migration is missing", async () => {
  f.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  const response = await post({ action: "request" }); expect(response.status).toBe(503); expect(f.send).not.toHaveBeenCalled();
});
it("invalidates a challenge after email delivery fails", async () => {
  f.send.mockRejectedValue(new Error("SMTP failed"));
  const response = await post({ action: "request" });
  expect(response.status).toBe(502); expect(f.update).toHaveBeenCalledWith({ used: true });
});
it("rejects invalid email and malformed OTP without querying the database", async () => {
  expect((await post({ action: "request", contactEmail: "invalid" })).status).toBe(400);
  expect((await post({ action: "verify", requestId, otp: "123" })).status).toBe(400);
  expect(f.rpc).not.toHaveBeenCalled();
});
it("rejects cross-origin OTP requests before sending mail", async () => {
  const response = await POST(new Request("http://localhost/api/organizer-applications/email", {
    method: "POST", headers: { Origin: "https://other.example" }, body: JSON.stringify({ action: "request", walletAddress, contactEmail }),
  }));
  expect(response.status).toBe(400); expect(f.rpc).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
});

it("blocks sending OTP for email bound to a different wallet", async () => {
  vi.mocked(ensureEmailWallet).mockRejectedValueOnce(new VerificationError("EMAIL_ALREADY_USED",409));
  const response = await post({action:"request"});
  expect(response.status).toBe(409); expect(f.send).not.toHaveBeenCalled(); expect(f.rpc).not.toHaveBeenCalled();
});
it("does not issue a proof if a different wallet claims the email during verification", async () => {
  vi.mocked(ensureEmailWallet).mockRejectedValueOnce(new VerificationError("EMAIL_ALREADY_USED",409));
  const response=await post({action:"verify",requestId,otp:"123456"});
  expect(response.status).toBe(409); expect(await response.json()).not.toHaveProperty("emailVerificationToken");
});
it("does not deliver a code if its one-minute database expiry cannot be saved", async () => {
  f.eq.mockResolvedValue({ error: { code: "XX000" } });
  const response = await post({ action: "request" });
  expect(response.status).toBe(503);
  expect(f.send).not.toHaveBeenCalled();
});
