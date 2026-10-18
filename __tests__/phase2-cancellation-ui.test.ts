import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { RoundCancellationPanel } from "@/components/round/RoundCancellationPanel";
import { refundRows, refundTotal } from "@/lib/roundRefunds";
import { copy } from "@/lib/copy";
const state = vi.hoisted(() => ({ cancelled: true, phase2: true, finalized: false, poolReturned: false, wallet: "0x1111111111111111111111111111111111111111", amounts: [2_000_000n, 3_000_000n], ended: false, hasHistory: true }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ isLoading: false, isError: false, name: "Student fund", endTime: state.ended ? 500n : 2000n, supportsPhase2: state.phase2, isCancelled: state.cancelled, finalized: state.finalized, cancelledPoolWithdrawn: state.poolReturned, pool: 10_000_000n, projectCount: 2n, admin: "0x1111111111111111111111111111111111111111", roundAddress: "0x2222222222222222222222222222222222222222" }) }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => 1000 }));
vi.mock("@/hooks/useProjects", () => ({
  useProjects: () => ({
    projects: [
      { id: "1", name: "P1", status: "approved", totalDonated: 2, totalDonatedRaw: 2_000_000n, supporterCount: 1 },
      { id: "2", name: "P2", status: "approved", totalDonated: 3, totalDonatedRaw: 3_000_000n, supporterCount: 1 },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useRoundRefunds", () => ({
  useRoundDonationHistory: () => ({ data: { totalDonated: 5_000_000n, donorCount: 1, contributions: {} }, isError: false, refetch: vi.fn() }),
  useRoundRefunds: () => { const rows = refundRows([1n,2n], state.amounts.map(result => ({ status: "success", result })), state.hasHistory ? { "1": 2_000_000n, "2": 3_000_000n } : {}); return { rows, total: refundTotal(rows), isReady: true, isError: false, maxProjects: 50n, refetch: vi.fn() }; },
}));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: state.wallet, isConnected: true, chainId: 43113 }), usePublicClient: () => ({}), useWriteContract: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: "vi", t: copy.vi }) }; });
beforeEach(() => Object.assign(state, { cancelled: true, phase2: true, finalized: false, poolReturned: false, wallet: "0x1111111111111111111111111111111111111111", amounts: [2_000_000n, 3_000_000n], ended: false, hasHistory: true }));
const render = () => renderToStaticMarkup(createElement(RoundCancellationPanel, { adminControls: true }));
it("cancelled round shows per-project refunds, full principal and the admin pool card", () => { const html = render(); expect(html).toContain(copy.vi.cancellation.banner); expect(html).toContain("5 USDC"); expect(html).toContain(copy.vi.cancellation.refundAll); expect(html).toContain(copy.vi.cancellation.withdrawTitle); expect(html).toContain(copy.vi.cancellation.poolOnly); });
it("a donor has refund access without admin pool controls", () => { state.wallet = "0x3333333333333333333333333333333333333333"; const html = render(); expect(html).toContain(copy.vi.cancellation.refundOne); expect(html).not.toContain(copy.vi.cancellation.withdrawTitle); });
it("fully refunded projects retain received labels; the pool withdrawal button stays disabled after recovery", () => { state.amounts = [0n, 0n]; state.poolReturned = true; const html = render(); expect(html.match(new RegExp(copy.vi.cancellation.refunded, "g"))).toHaveLength(2); expect(html).toContain(copy.vi.cancellation.withdrawn); const button = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(match => match[2].includes(copy.vi.cancellation.withdrawn)); expect(button?.[1]).toMatch(/\sdisabled(?:=|\s|$)/); });
it("a wallet without donation history or balances sees an empty-refund message", () => { state.hasHistory = false; state.amounts = [0n,0n]; expect(render()).toContain(copy.vi.cancellation.noRefund); });
it("only an admin can cancel; expired unfinalized rounds still allow opening confirmation", () => { state.cancelled = false; state.ended = true; expect(render()).toContain(copy.vi.phase2.cancelRound); state.wallet = "0x3333333333333333333333333333333333333333"; expect(render()).toBe(""); });
it("finalized rounds cannot show cancellation and Phase 1 shows upgrade guidance", () => { state.cancelled = false; state.finalized = true; expect(render()).toBe(""); state.phase2 = false; expect(render()).toContain(copy.vi.phase2.phase2Required); });
