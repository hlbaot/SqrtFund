import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminView } from "@/views/admin";
import { copy } from "@/lib/copy";
import { projectReviewCopy } from "@/lib/projectReview";
const state = vi.hoisted(() => ({ supports: true, finalized: false, cancelled: false, wallet: "0x1111111111111111111111111111111111111111", now: 1000, tab: "organizer", authLoading: false, authError: false, access: true }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => state.now }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams({ tab: state.tab }) }));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: state.wallet, chainId: 43113, isConnected: true, status: "connected" }), usePublicClient: () => ({}), useWriteContract: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ role: state.access ? "admin" : "guest", isAuthorizationLoading: state.authLoading, isAuthorizationError: state.authError }) }));
vi.mock("@/hooks/useAdminRounds", () => ({ useAdminRounds: () => ({ roundAddress: "0x2222222222222222222222222222222222222222", rounds: [{address:"0x2222222222222222222222222222222222222222"}], isLoading: false, isError: false, selectRound: vi.fn() }) }));
vi.mock("@/components/admin/PlatformDashboard", () => ({ PlatformDashboard: () => createElement("p", null, "PlatformMarker") }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: "0x2222222222222222222222222222222222222222", allRounds: ["0x2222222222222222222222222222222222222222", "0x6666666666666666666666666666666666666666"], admin: "0x1111111111111111111111111111111111111111", name: "Demo round", endTime: 2000n, finalized: state.finalized, isCancelled: state.cancelled, leftover: 0n, leftoverWithdrawn: false, isLoading: false }) }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ supportsRejection: state.supports, projects: [
  { id: "1", contractId: 1n, name: "PendingAlpha", ownerAddress: "0x3333333333333333333333333333333333333333", description: "D", contactUrl: "", approved: false, rejected: false },
  { id: "2", contractId: 2n, name: "RejectedBeta", ownerAddress: "0x3333333333333333333333333333333333333333", description: "D", contactUrl: "", approved: false, rejected: true },
] }) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: "vi", t: copy.vi }) }; });
vi.mock("@/components/admin/CreateRoundForm", () => ({ CreateRoundForm: () => null }));
vi.mock("@/components/admin/DepositPoolForm", () => ({ DepositPoolForm: () => null }));
vi.mock("@/components/admin/MintTestUsdcForm", () => ({ MintTestUsdcForm: () => null }));
vi.mock("@/components/admin/FinalizeButton", () => ({ FinalizeButton: () => null }));
vi.mock("@/components/round/RoundCancellationPanel", () => ({ RoundCancellationPanel: () => null }));
vi.mock("@/components/common/AOSInit", () => ({ AOSInit: () => null }));
beforeEach(() => Object.assign(state, { supports: true, finalized: false, cancelled: false, wallet: "0x1111111111111111111111111111111111111111", now: 1000, tab: "organizer", authLoading: false, authError: false, access: true }));
const render = () => renderToStaticMarkup(createElement(AdminView));
it("renders review actions for pending projects and rejected badges in the filterable admin queue", () => {
  const html = render();
  const cards = [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match => match[0]);
  const pending = cards.find(card => card.includes("PendingAlpha"));
  const rejected = cards.find(card => card.includes("RejectedBeta"));
  expect(pending).toContain(copy.vi.admin.approveBtn); expect(pending).toContain(copy.vi.rejection.action);
  expect(rejected).toContain(projectReviewCopy.vi.rejectedBadge);
  expect(rejected).not.toContain('data-variant="accent"'); expect(rejected).not.toContain('data-variant="destructive"');
  expect(html).toContain('value="rejected"');
});
it.each(["old", "finalized", "cancelled", "factory-owner"] as const)("shows disabled guidance for old rounds and hides unauthorized/unavailable actions: %s", condition => {
  if (condition === "old") state.supports = false;
  if (condition === "finalized") state.finalized = true;
  if (condition === "cancelled") state.cancelled = true;
  if (condition === "factory-owner") state.wallet = "0x4444444444444444444444444444444444444444";
  const html = render();
  const labels = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(match => match[1].replace(/<[^>]+>/g, "").trim());
  expect(labels).not.toContain(copy.vi.rejection.action);
  if (condition === "old") { expect(labels).toContain(copy.vi.admin.approveBtn); expect(html).toContain(copy.vi.moderation.legacy); }

});

it("replaces both actions as the clock reaches endTime without changing the round read", () => {
  expect(render()).toContain(copy.vi.rejection.action);
  state.now = 2000;
  const html = render();
  expect(html).toContain(projectReviewCopy.vi.ended);
  expect(html).toContain(projectReviewCopy.vi.expiredBadge);
  const labels = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(match => match[1].replace(/<[^>]+>/g, "").trim());
  expect(labels).not.toContain(copy.vi.rejection.action); expect(labels).not.toContain(copy.vi.admin.approveBtn);
});

it("follows dashboard tab changes from the wallet menu URL", () => {
  expect(render()).not.toContain("PlatformMarker"); state.tab = "platform";
  expect(render()).toContain("PlatformMarker"); state.tab = "organizer";
  expect(render()).not.toContain("PlatformMarker");
});
it("shows a loading view until wallet authorization resolves", () => {
  state.access = false; state.authLoading = true;
  const html = render(); expect(html).not.toContain(copy.vi.admin.unauthorizedAdminTitle); expect(html).not.toContain("PendingAlpha");
});
it("shows a retryable read error instead of denying an unresolved wallet", () => {
  state.access = false; state.authError = true;
  expect(render()).toContain("Chưa xác định được quyền quản trị"); expect(render()).not.toContain(copy.vi.admin.unauthorizedAdminTitle);
});

it("limits Organizer round options to rounds owned by the connected wallet", () => {
  expect(render()).not.toContain("0x6666666666666666666666666666666666666666");
});
