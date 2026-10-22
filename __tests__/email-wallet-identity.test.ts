import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => {
  const query = { select: () => query, not: () => query, order: () => query, range: f.range };
  return { rpc: f.rpc, from: () => query };
} }));
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { emailIdentityHash } from "@/lib/emailIdentity";
const wallet = `0x${"1".repeat(40)}`, other = `0x${"2".repeat(40)}`;
beforeEach(() => {
  vi.clearAllMocks(); f.range.mockResolvedValue({ data: [], error: null });
  f.rpc.mockResolvedValue({ data: {status:"OK"}, error: null });
});
afterEach(() => vi.restoreAllMocks());
it("normalizes case, spaces and +tag identically across roles", () => {
  expect(emailIdentityHash(" User+test@School.edu.vn ")).toBe(emailIdentityHash("user@school.edu.vn"));
});
it("checks availability without reserving an unverified email", async () => {
  const hash = emailIdentityHash("user@school.edu.vn"); await ensureEmailWallet(hash, wallet);
  expect(f.rpc).toHaveBeenCalledWith("enforce_email_wallet", {p_email_hash:hash,p_wallet_address:wallet,p_claim:false});
});
it("claims a verified email atomically for one wallet", async () => {
  const hash = emailIdentityHash("user@school.edu.vn"); await ensureEmailWallet(hash, wallet, true);
  expect(f.rpc).toHaveBeenCalledWith("enforce_email_wallet", {p_email_hash:hash,p_wallet_address:wallet,p_claim:true});
});
it("rejects an email claimed by another wallet in either role", async () => {
  f.rpc.mockResolvedValue({ data: {status:"EMAIL_ALREADY_USED"}, error:null });
  await expect(ensureEmailWallet(emailIdentityHash("user@school.edu.vn"), other, true)).rejects.toMatchObject({code:"EMAIL_ALREADY_USED",status:409});
});
it("retains ownership from verified Organizer applications created before migration", async () => {
  f.range.mockResolvedValue({ data: [{ contact_email:"USER+club@school.edu.vn", wallet_address:other }], error:null });
  await expect(ensureEmailWallet(emailIdentityHash("user@school.edu.vn"), wallet, true)).rejects.toMatchObject({code:"EMAIL_ALREADY_USED"});
  expect(f.rpc).not.toHaveBeenCalled();
});
it("allows the same wallet to hold Student and Organizer roles", async () => {
  f.range.mockResolvedValue({ data: [{contact_email:"user@school.edu.vn",wallet_address:wallet}], error:null });
  await expect(ensureEmailWallet(emailIdentityHash("user@school.edu.vn"),wallet,true)).resolves.toBeUndefined();
});
it("checks legacy records beyond the first database page", async () => {
  f.range.mockResolvedValueOnce({ data:Array.from({length:1000},()=>({contact_email:"else@school.edu.vn",wallet_address:other})),error:null })
    .mockResolvedValueOnce({data:[{contact_email:"user@school.edu.vn",wallet_address:other}],error:null});
  await expect(ensureEmailWallet(emailIdentityHash("user@school.edu.vn"),wallet)).rejects.toMatchObject({code:"EMAIL_ALREADY_USED"});
  expect(f.range).toHaveBeenLastCalledWith(1000,1999);
});
it("fails closed when the identity migration has not been applied", async () => {
  f.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});
  await expect(ensureEmailWallet(emailIdentityHash("user@school.edu.vn"),wallet,true)).rejects.toMatchObject({code:"DB_SCHEMA_MISMATCH",status:503});
});
it("fails closed on legacy lookup failure instead of using memory", async () => {
  f.range.mockResolvedValue({data:null,error:{code:"42P01"}});
  await expect(ensureEmailWallet(emailIdentityHash("user@school.edu.vn"),wallet,true)).rejects.toMatchObject({code:"DB_SCHEMA_MISMATCH"});
  expect(f.rpc).not.toHaveBeenCalled();
});
