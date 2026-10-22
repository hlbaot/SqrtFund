import { beforeEach, expect, it, vi } from "vitest";
import { updateOrganizerApplicationStatus } from "@/lib/server/organizerApplications";
const f = vi.hoisted(() => ({ eq: vi.fn(), update: vi.fn(), result: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/emailWalletIdentity", () => ({ ensureEmailWallet: vi.fn() }));
vi.mock("@/lib/verify/supabaseAdmin", () => ({ supabaseAdmin: () => {
  const query = { update: f.update, eq: f.eq, select: () => query, maybeSingle: f.result };
  f.update.mockReturnValue(query); f.eq.mockReturnValue(query);
  return { from: () => query };
} }));
beforeEach(() => vi.clearAllMocks());
it("only updates the exact application revision authorized by the Admin", async () => {
  f.result.mockResolvedValue({ data: { id: "application", status: "approved", wallet_address: "0x123" }, error: null });
  const app = await updateOrganizerApplicationStatus("application", { status: "approved", expectedUpdatedAt: "2026-10-22T00:00:00Z" });
  expect(f.eq).toHaveBeenCalledWith("id", "application");
  expect(f.eq).toHaveBeenCalledWith("updated_at", "2026-10-22T00:00:00Z");
  expect(app?.status).toBe("approved");
});
it("does not overwrite a decision when the signed revision has already changed", async () => {
  f.result.mockResolvedValue({ data: null, error: null });
  expect(await updateOrganizerApplicationStatus("application", { status: "rejected", expectedUpdatedAt: "2026-10-22T00:00:00Z" })).toBeNull();
});
