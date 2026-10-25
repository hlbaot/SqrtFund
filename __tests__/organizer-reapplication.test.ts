import { beforeEach, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { organizerReapplicationMessage } from "@/lib/organizerReapplication";
import { verifyOrganizerReapplication } from "@/lib/server/organizerReapplication";
import type { OrganizerApplication } from "@/lib/server/organizerApplications";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/contracts/addresses", () => ({ factoryAddress: `0x${"3".repeat(40)}`, TARGET_CHAIN_ID: 43113 }));
const account = privateKeyToAccount(`0x${"1".repeat(64)}`);
const previous: OrganizerApplication = {
  id: "old-application", walletAddress: account.address, organizationName: "Student Club", contactEmail: "club@example.test",
  emailVerifiedAt: "2026-10-01T00:00:00Z", status: "revoked", reason: "Host a funding round",
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z",
};
async function signed() {
  const body = { walletAddress: account.address, organizationName: previous.organizationName, contactEmail: previous.contactEmail,
    reason: previous.reason, applicationId: previous.id, expectedUpdatedAt: previous.updatedAt, issuedAt: Date.now() };
  return { ...body, signature: await account.signMessage({ message: organizerReapplicationMessage(body, `0x${"3".repeat(40)}`, 43113) }) };
}
beforeEach(() => vi.restoreAllMocks());
it("reuses the previous verified email only after the original wallet signs its reapplication", async () => {
  expect(await verifyOrganizerReapplication(await signed(), previous)).toBe(true);
});
it("rejects signatures reused for different wallets, email, fields, application versions or domain", async () => {
  const body = await signed();
  for (const changes of [
    { walletAddress: `0x${"2".repeat(40)}` }, { contactEmail: "other@example.test" }, { organizationName: "Changed" },
    { reason: "Altered message" }, { applicationId: "another" }, { expectedUpdatedAt: "2026-10-26T00:00:00Z" },
    { issuedAt: Date.now() - 301_000 }, { issuedAt: Date.now() + 31_000 },
  ]) expect(await verifyOrganizerReapplication({ ...body, ...changes }, previous)).toBe(false);
  const signature = await account.signMessage({ message: organizerReapplicationMessage(body, `0x${"4".repeat(40)}`, 43113) });
  expect(await verifyOrganizerReapplication({ ...body, signature }, previous)).toBe(false);
});
it("does not accept a frontend verification flag or a pending, approved or unverified old application", async () => {
  const body = await signed();
  expect(await verifyOrganizerReapplication({ ...body, signature: undefined, emailVerified: true }, previous)).toBe(false);
  expect(await verifyOrganizerReapplication(body, undefined)).toBe(false);
  expect(await verifyOrganizerReapplication(body, { ...previous, emailVerifiedAt: null })).toBe(false);
  for (const status of ["pending", "approved"] as const) expect(await verifyOrganizerReapplication(body, { ...previous, status })).toBe(false);
});

const db = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => db }));
vi.mock("@/lib/server/emailWalletIdentity", () => ({ ensureEmailWallet: vi.fn().mockRejectedValue(new Error("WALLET_ALREADY_VERIFIED")) }));
import { ensureEmailWallet } from "@/lib/server/emailWalletIdentity";
import { resubmitOrganizerApplication } from "@/lib/server/organizerApplications";

it("reopens the same verified application for admin review without re-binding its email", async () => {
  db.from.mockReturnValue(db); db.update.mockReturnValue(db); db.eq.mockReturnValue(db); db.select.mockReturnValue(db);
  db.maybeSingle.mockResolvedValue({ data: {
    id: previous.id, wallet_address: previous.walletAddress, organization_name: "Updated Club", contact_email: previous.contactEmail,
    email_verified_at: previous.emailVerifiedAt, reason: "Updated funding plan", status: "pending",
    created_at: previous.createdAt, updated_at: new Date().toISOString(),
  } });
  const result = await resubmitOrganizerApplication(previous, { ...previous, organizationName: "Updated Club", reason: "Updated funding plan", emailVerifiedAt: previous.emailVerifiedAt! });
  expect(result.id).toBe(previous.id);
  expect(result.status).toBe("pending");
  expect(result.contactEmail).toBe(previous.contactEmail);
  expect(result.emailVerifiedAt).toBe(previous.emailVerifiedAt);
  expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", organization_name: "Updated Club", reviewed_at: null, tx_hash: null }));
  expect(db.eq).toHaveBeenCalledWith("updated_at", previous.updatedAt);
  expect(db.eq).toHaveBeenCalledWith("status", "revoked");
  expect(ensureEmailWallet).not.toHaveBeenCalled();
});

it("does not invent a pending application if the database rejects or the application changed", async () => {
  db.from.mockReturnValue(db); db.update.mockReturnValue(db); db.eq.mockReturnValue(db); db.select.mockReturnValue(db);
  db.maybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(resubmitOrganizerApplication(previous, { ...previous, emailVerifiedAt: previous.emailVerifiedAt! })).rejects.toMatchObject({ code: "APPLICATION_CHANGED" });
  db.maybeSingle.mockResolvedValue({ data: null, error: { code: "DB_ERROR" } });
  await expect(resubmitOrganizerApplication(previous, { ...previous, emailVerifiedAt: previous.emailVerifiedAt! })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
});
