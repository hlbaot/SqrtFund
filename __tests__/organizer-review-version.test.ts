import { beforeEach, expect, it, vi } from "vitest";
import { updateOrganizerApplicationStatus } from "@/lib/server/organizerApplications";
const f = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({
  ensureEmailWallet: vi.fn(),
}));
vi.mock("@/lib/verify/supabaseAdmin", () => ({
  supabaseAdmin: () => ({ rpc: f.rpc }),
}));
const reviewer = `0x${"1".repeat(40)}`;
const version = "2026-10-22T00:00:00Z";
const row = {
  id: "04040404-0404-4404-8404-040404040404",
  status: "approved",
  wallet_address: `0x${"2".repeat(40)}`,
  organization_name: "Fixture Club",
  contact_email: "fixture@example.invalid",
  reason: "Fixture review",
  created_at: version,
  updated_at: "2026-10-27T00:00:00Z",
};
beforeEach(() => vi.clearAllMocks());
it("passes the exact signed revision and reviewer to the atomic database operation", async () => {
  f.rpc.mockResolvedValue({
    data: { status: "OK", application: row },
    error: null,
  });
  const app = await updateOrganizerApplicationStatus(row.id, {
    status: "approved",
    expectedUpdatedAt: version,
    reviewedBy: reviewer,
  });
  expect(f.rpc).toHaveBeenCalledWith("review_organizer_application", {
    p_id: row.id,
    p_status: "approved",
    p_expected_updated_at: version,
    p_reviewed_by: reviewer,
    p_tx_hash: null,
    p_revocation_reason: null,
  });
  expect(app?.status).toBe("approved");
  expect(app?.updatedAt).toBe(row.updated_at);
});
it("does not overwrite a decision whose signed revision has changed", async () => {
  f.rpc.mockResolvedValue({ data: { status: "CHANGED" }, error: null });
  expect(
    await updateOrganizerApplicationStatus(row.id, {
      status: "rejected",
      expectedUpdatedAt: version,
      reviewedBy: reviewer,
    }),
  ).toBeNull();
});
it("surfaces DB errors rather than treating them as a revision conflict", async () => {
  f.rpc.mockResolvedValue({ data: null, error: { code: "08006" } });
  await expect(
    updateOrganizerApplicationStatus(row.id, {
      status: "rejected",
      expectedUpdatedAt: version,
      reviewedBy: reviewer,
    }),
  ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503 });
});
