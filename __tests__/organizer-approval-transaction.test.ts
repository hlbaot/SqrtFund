import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { PlatformDashboard } from "@/components/admin/PlatformDashboard";
import { TransactionFlow, cancelTransactionFlows, txToast } from "@/lib/txToast";
const f = vi.hoisted(() => ({ write: vi.fn(), receipt: vi.fn(), approve: vi.fn(), invalidate: vi.fn(), click: undefined as (() => void) | undefined }));
const hash = `0x${"a".repeat(64)}`;
const wallet = `0x${"1".repeat(40)}`;
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: true, chainId: 43113, address: `0x${"2".repeat(40)}` }), usePublicClient: () => ({ waitForTransactionReceipt: f.receipt }), useWriteContract: () => ({ writeContractAsync: f.write }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: f.invalidate }) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => () => new TransactionFlow() }));
vi.mock("@/lib/organizerRegistry", () => ({ loadOrganizerRegistry: async () => [] }));
vi.mock("@/hooks/useOrganizerApplications", () => ({ useOrganizerApplicationsAdmin: () => ({
  applications: [{ id: "application-id", organizationName: "University", walletAddress: `0x${"1".repeat(40)}`, contactEmail: "fixture@example.test", status: "pending", reason: "Organize funding", createdAt: "2026-10-22T00:00:00Z" }],
  pendingCount: 1, approveApplication: f.approve, refetch: async () => {},
}) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy.vi, locale: "vi" }) }; });
vi.mock("@/components/ui/Button", () => ({ Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => {
  if (Array.isArray(children) && children.includes(copy.vi.admin.btnGrantAndApprove)) f.click = onClick;
  return createElement("button", null, children);
} }));
beforeEach(() => {
  vi.clearAllMocks(); txToast.dismiss(); f.click = undefined;
  f.write.mockResolvedValue(hash); f.receipt.mockResolvedValue({ status: "success" }); f.approve.mockResolvedValue({});
  renderToStaticMarkup(createElement(PlatformDashboard, { isPlatformOwner: true }));
  expect(f.click).toBeTypeOf("function");
});
afterEach(() => { cancelTransactionFlows(); txToast.dismiss(); });
it("confirms on Fuji before marking approved, and puts the hash in its dedicated toast field", async () => {
  f.click!();
  await vi.waitFor(() => expect(f.approve).toHaveBeenCalled());
  await vi.waitFor(() => expect(txToast.getToasts()[0]?.type).toBe("success"));
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ functionName: "setOrganizer", args: [wallet, true], chainId: 43113 }));
  expect(txToast.getToasts()[0]).toMatchObject({ txHash: hash });
  expect(txToast.getToasts()[0].description).toBeUndefined();
});
it("does not approve an application when the on-chain transaction reverts", async () => {
  f.receipt.mockResolvedValue({ status: "reverted" });
  f.click!();
  await vi.waitFor(() => expect(txToast.getToasts()[0]?.type).toBe("error"));
  expect(f.approve).not.toHaveBeenCalled();
});
it("rejects an object returned instead of a transaction hash without crashing the page", async () => {
  f.write.mockResolvedValue({ hash });
  f.click!();
  await vi.waitFor(() => expect(txToast.getToasts()[0]?.type).toBe("error"));
  expect(f.receipt).not.toHaveBeenCalled();
  expect(f.approve).not.toHaveBeenCalled();
  expect(txToast.getToasts()[0].txHash).toBeUndefined();
});

it("does not render the platform dashboard for a non-owner account", () => {
  f.click = undefined;
  const html = renderToStaticMarkup(createElement(PlatformDashboard, { isPlatformOwner: false }));
  expect(html).toBe("");
  expect(f.click).toBeUndefined();
});
