import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => ({ rpc: f.rpc }) }));
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { legacyEmailIdentityHash } from "@/lib/emailIdentity";
const wallet = `0x${"1".repeat(40)}`, identity = `0x${"a".repeat(64)}`;
beforeEach(() => {
  vi.clearAllMocks(); f.rpc.mockResolvedValue({ data: { status: "OK", verificationId: identity }, error: null });
});
it("uses the canonical email directly as the database identity key", async () => {
  expect(await ensureEmailWallet(" User+club@School.edu.vn ", wallet)).toBe(identity);
  expect(f.rpc).toHaveBeenCalledWith("enforce_plain_email_wallet", expect.objectContaining({
    p_email: "user@school.edu.vn", p_wallet_address: wallet, p_claim: false,
    p_legacy_hash: legacyEmailIdentityHash("user@school.edu.vn"),
  }));
});
it("proposes random bytes32 identifiers rather than deriving new identifiers from emails", async () => {
  await ensureEmailWallet("user@school.edu.vn", wallet);
  await ensureEmailWallet("user@school.edu.vn", wallet);
  const first = f.rpc.mock.calls[0][1].p_new_identity;
  const second = f.rpc.mock.calls[1][1].p_new_identity;
  expect(first).toMatch(/^0x[0-9a-f]{64}$/); expect(second).not.toBe(first);
  expect(first).not.toBe(legacyEmailIdentityHash("user@school.edu.vn"));
  // Database trả cùng ID ổn định cho lần resend; ID đề xuất sau không thay ID cũ.
  expect(await ensureEmailWallet("user@school.edu.vn", wallet)).toBe(identity);
});
it("claims only after successful OTP or a verified email proof", async () => {
  await ensureEmailWallet("user@school.edu.vn", wallet, true);
  expect(f.rpc).toHaveBeenCalledWith("enforce_plain_email_wallet", expect.objectContaining({ p_email: "user@school.edu.vn", p_claim: true }));
});
it.each(["EMAIL_ALREADY_USED", "WALLET_ALREADY_VERIFIED"])("enforces both directions of the one-to-one relation: %s", async status => {
  f.rpc.mockResolvedValue({ data: { status }, error: null });
  await expect(ensureEmailWallet("user@school.edu.vn", wallet, true)).rejects.toMatchObject({ code: status, status: 409 });
});
it("fails closed when the new migration is missing", async () => {
  f.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  await expect(ensureEmailWallet("user@school.edu.vn", wallet)).rejects.toMatchObject({ code: "DB_SCHEMA_MISMATCH", status: 503 });
});
it("does not return a malformed verification identifier", async () => {
  f.rpc.mockResolvedValue({ data: { status: "OK", verificationId: "email@example.com" }, error: null });
  await expect(ensureEmailWallet("user@school.edu.vn", wallet)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
});
