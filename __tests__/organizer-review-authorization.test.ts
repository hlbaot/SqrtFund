import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { organizerReviewMessage, type OrganizerReview } from "@/lib/organizerReview";
import { authorizeOrganizerReview } from "@/lib/server/organizerReviewAuthorization";
const f = vi.hoisted(() => ({ owner: vi.fn(), chain: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("viem", async importOriginal => {
  const actual = await importOriginal<typeof import("viem")>();
  return { ...actual, createPublicClient: () => ({ readContract: f.owner, getChainId: f.chain, verifyMessage: actual.verifyMessage }) };
});
const owner = privateKeyToAccount(`0x${"11".repeat(32)}`);
const organizer = privateKeyToAccount(`0x${"22".repeat(32)}`);
const factory = `0x${"3".repeat(40)}`;
const review: OrganizerReview = {
  id: "application-id", status: "approved", txHash: `0x${"a".repeat(64)}`,
  reviewedBy: owner.address, expectedUpdatedAt: "2026-10-22T00:00:00Z", issuedAt: 1_792_646_400_000,
};
async function signed(account = owner, values = review) {
  return { ...values, signature: await account.signMessage({ message: organizerReviewMessage(values, factory, 43113) }) };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(review.issuedAt);
  vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", factory); vi.stubEnv("NEXT_PUBLIC_CHAIN_ID", "43113");
  f.owner.mockResolvedValue(owner.address); f.chain.mockResolvedValue(43113);
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
it("accepts a decision signed by the current Factory owner", async () => {
  expect(await authorizeOrganizerReview(await signed())).toMatchObject(review);
});
it("rejects an Organizer's signature even when it claims the owner's address", async () => {
  await expect(authorizeOrganizerReview(await signed(organizer))).rejects.toMatchObject({ code: "PLATFORM_OWNER_ONLY", status: 403 });
});
it("does not authorize a non-owner based on the reviewedBy field", async () => {
  await expect(authorizeOrganizerReview(await signed(organizer, { ...review, reviewedBy: organizer.address }))).rejects.toMatchObject({ status: 403 });
});
it("rejects unsigned requests and expired signatures", async () => {
  await expect(authorizeOrganizerReview({ ...review })).rejects.toMatchObject({ code: "ADMIN_SIGNATURE_REQUIRED" });
  const body = await signed(); vi.setSystemTime(review.issuedAt + 300_001);
  await expect(authorizeOrganizerReview(body)).rejects.toMatchObject({ code: "ADMIN_SIGNATURE_EXPIRED" });
});
it.each(["status", "expectedUpdatedAt", "id", "txHash"])("binds the owner's signature to the reviewed %s", async field => {
  const body = await signed();
  const changed = { status: "rejected", expectedUpdatedAt: "2026-10-22T01:00:00Z", id: "other-application", txHash: `0x${"b".repeat(64)}` };
  await expect(authorizeOrganizerReview({ ...body, [field]: changed[field as keyof typeof changed] })).rejects.toMatchObject({ status: 403 });
});
it("immediately rejects the previous Admin after ownership transfers", async () => {
  const body = await signed(); f.owner.mockResolvedValue(organizer.address);
  await expect(authorizeOrganizerReview(body)).rejects.toMatchObject({ status: 403 });
});
it("does not reuse signatures across Factory addresses", async () => {
  const body = await signed(); vi.stubEnv("NEXT_PUBLIC_FACTORY_ADDRESS", `0x${"4".repeat(40)}`);
  await expect(authorizeOrganizerReview(body)).rejects.toMatchObject({ status: 403 });
});
it("fails closed when the owner lookup fails or the RPC connects to a different chain", async () => {
  const body = await signed(); f.owner.mockRejectedValue(new Error("RPC unavailable"));
  await expect(authorizeOrganizerReview(body)).rejects.toMatchObject({ status: 503 });
  f.chain.mockResolvedValue(1);
  await expect(authorizeOrganizerReview(body)).rejects.toMatchObject({ code: "RPC_CHAIN_MISMATCH", status: 503 });
});
