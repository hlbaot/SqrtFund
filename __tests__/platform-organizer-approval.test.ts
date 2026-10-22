import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  chainId: 43113, write: vi.fn(), read: vi.fn(), receipt: vi.fn(), approve: vi.fn(),
  invalidate: vi.fn(), finish: vi.fn(), success: vi.fn(), error: vi.fn(),
  buttons: [] as (() => void)[],
  application: { id: "application-1", walletAddress: "0x2222222222222222222222222222222222222222", organizationName: "Test Club", contactEmail: "contact@example.com", reason: "A funding round", status: "pending", createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z" },
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: true, chainId: f.chainId }),
  usePublicClient: () => ({ readContract: f.read, waitForTransactionReceipt: f.receipt }),
  useWriteContract: () => ({ writeContractAsync: f.write }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: f.invalidate }) }));
vi.mock("@/lib/organizerRegistry", () => ({ loadOrganizerRegistry: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/contracts/addresses", () => ({ factoryAddress: "0x3333333333333333333333333333333333333333", TARGET_CHAIN_ID: 43113, ZERO_ADDRESS: "0x0000000000000000000000000000000000000000" }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy.vi, locale: "vi" }) }; });
vi.mock("@/hooks/useOrganizerApplications", () => ({ useOrganizerApplicationsAdmin: () => ({ applications: [f.application], approveApplication: f.approve, rejectApplication: vi.fn(), refetch: vi.fn(), isLoading: false, isError: false }) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => () => ({ cancelled: false, wait: (run: () => Promise<unknown>) => run(), finish: f.finish, toast: { pending: vi.fn(), success: f.success, error: f.error } }) }));
vi.mock("@/components/ui/Button", async original => {
  const { Button } = await original<typeof import("@/components/ui/Button")>();
  return { Button: (props: ComponentProps<typeof Button>) => {
    if (props.onClick && props.variant === "primary" && props.size === "sm") f.buttons.push(() => props.onClick!({} as import("react").MouseEvent<HTMLButtonElement>));
    return createElement(Button, props);
  } };
});
import { PlatformDashboard } from "@/components/admin/PlatformDashboard";

beforeEach(() => {
  vi.clearAllMocks(); f.buttons = []; f.chainId = 43113;
  f.read.mockResolvedValue(false); f.write.mockResolvedValue(`0x${"a".repeat(64)}`);
  f.receipt.mockResolvedValue({ status: "success" }); f.approve.mockResolvedValue({}); f.invalidate.mockResolvedValue(undefined);
});
function approve() {
  renderToStaticMarkup(createElement(PlatformDashboard, { isPlatformOwner: true }));
  expect(f.buttons).toHaveLength(1);
  return f.buttons[0];
}
it("recovers a failed database sync without signing a second grant or reloading", async () => {
  f.approve.mockRejectedValueOnce(new Error("Database temporarily unavailable"));
  const click = approve(); click();
  await vi.waitFor(() => expect(f.finish).toHaveBeenCalledTimes(1));
  expect(f.error).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.stringContaining("không cần reload"));
  f.read.mockResolvedValue(true);
  click();
  await vi.waitFor(() => expect(f.finish).toHaveBeenCalledTimes(2));
  expect(f.write).toHaveBeenCalledTimes(1);
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ chainId: 43113, functionName: "setOrganizer" }));
  expect(f.approve).toHaveBeenCalledTimes(2);
  expect(f.approve.mock.calls[1][1]).toBe(`0x${"a".repeat(64)}`);
  expect(f.invalidate).toHaveBeenCalled();
});
it("synchronizes an already authorized wallet without another transaction", async () => {
  f.read.mockResolvedValue(true);
  approve()();
  await vi.waitFor(() => expect(f.finish).toHaveBeenCalled());
  expect(f.write).not.toHaveBeenCalled();
  expect(f.approve).toHaveBeenCalledWith(f.application.id, undefined, expect.any(String));
});
it("prevents duplicate approval clicks before React updates disabled state", async () => {
  const click = approve(); click(); click();
  await vi.waitFor(() => expect(f.finish).toHaveBeenCalled());
  expect(f.write).toHaveBeenCalledTimes(1); expect(f.approve).toHaveBeenCalledTimes(1);
});
it("does not approve an application when the receipt reverts", async () => {
  f.receipt.mockResolvedValue({ status: "reverted" });
  approve()();
  await vi.waitFor(() => expect(f.finish).toHaveBeenCalled());
  expect(f.approve).not.toHaveBeenCalled(); expect(f.error).toHaveBeenCalled();
});
