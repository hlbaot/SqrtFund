import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { DepositPoolForm } from "@/components/admin/DepositPoolForm";
import { copy } from "@/lib/copy";
const state = vi.hoisted(() => ({ amount: "100", locale: "en" as "en" | "vi", balance: undefined as bigint | undefined, loading: true, error: false, round: true, roundsLoading: false, roundsError: false, token: "0xFf56491e29085043DbB11cd01D54cC1449A3d686" }));
// Seed the user's typed amount while keeping React's real hook dispatcher for SSR rendering.
vi.mock("react", async importOriginal => { const react = await importOriginal<typeof import("react")>(); return { ...react, useState: (initial: unknown) => react.useState(initial === "" ? state.amount : initial) }; });
vi.mock("@/hooks/useAdminRounds", () => ({ useAdminRounds: () => ({ roundAddress: state.round ? "0x2222222222222222222222222222222222222222" : undefined, rounds: state.round ? [{ address: "0x2222222222222222222222222222222222222222", name: "Latest round" }] : [], totalRounds: state.round ? 1 : 0, selectRound: vi.fn(), isLoading: state.roundsLoading, isError: state.roundsError }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ token: state.token, admin: "0x1111111111111111111111111111111111111111", pool: 0n, finalized: false, isCancelled: false, isLoading: false, isError: false }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({ balance: state.balance, isReady: !state.loading && !state.error && state.balance !== undefined, isLoading: state.loading, isError: state.error }) }));
vi.mock("@/lib/contracts/addresses", () => ({ TARGET_CHAIN_ID: 43113, usdcAddress: "0xFf56491e29085043DbB11cd01D54cC1449A3d686", ZERO_ADDRESS: "0x0000000000000000000000000000000000000000" }));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: true, chainId: 43113 }), usePublicClient: () => ({}), useWriteContract: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy[state.locale], locale: state.locale }) }; });
beforeEach(() => Object.assign(state, { amount: "100", locale: "en", balance: undefined, loading: true, error: false, round: true, roundsLoading: false, roundsError: false, token: "0xFf56491e29085043DbB11cd01D54cC1449A3d686" }));
const render = () => renderToStaticMarkup(createElement(DepositPoolForm));
const submitTag = (html: string) => html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
it("does not show an insufficient-balance error while a typed deposit awaits its balance", () => {
  const html = render(); expect(html).toContain(copy.en.tokenBalance.loading); expect(html).not.toContain(copy.en.admin.validationExceedsBalance); expect(html).not.toContain("Your balance: 0"); expect(submitTag(html)).toMatch(/\sdisabled(?:=|\s|>)/);
});
it.each(["en", "vi"] as const)("shows create-round guidance for an empty factory in %s, even with a funded wallet", locale => {
  Object.assign(state, { locale, round: false, loading: false, balance: 1_100_000_000n });
  const html = render(); expect(html).toContain(copy[locale].tokenBalance.noRound); expect(html).not.toContain(copy[locale].admin.validationExceedsBalance); expect(submitTag(html)).toMatch(/\sdisabled(?:=|\s|>)/);
});
it("separates failed reads from a successful zero balance", () => {
  state.loading = false; state.error = true; let html = render(); expect(html).toContain(copy.en.tokenBalance.error); expect(html).not.toContain(copy.en.admin.validationExceedsBalance);
  state.error = false; state.balance = 0n; html = render(); expect(html).toContain(copy.en.admin.validationExceedsBalance); expect(submitTag(html)).toMatch(/\sdisabled(?:=|\s|>)/);
});
it("enables a valid deposit with the shared 1,100 USDC balance and a selected round", () => {
  state.loading = false; state.balance = 1_100_000_000n; const html = render(); expect(html).toContain("1,100"); expect(html).toContain("Latest round"); expect(html).not.toContain(copy.en.admin.validationExceedsBalance); expect(submitTag(html)).not.toMatch(/\sdisabled(?:=|\s|>)/);
});
it("blocks a selected round whose token differs from the configured wallet token", () => {
  state.loading = false; state.balance = 1_100_000_000n; state.token = "0x3333333333333333333333333333333333333333"; const html = render(); expect(html).toContain(copy.en.tokenBalance.tokenMismatch); expect(submitTag(html)).toMatch(/\sdisabled(?:=|\s|>)/);
});
it("does not turn factory loading or RPC failure into an empty-round or zero-balance warning", () => {
  state.round = false; state.roundsLoading = true; let html = render(); expect(html).toContain(copy.en.tokenBalance.loadingRounds); expect(html).not.toContain(copy.en.tokenBalance.noRound);
  state.roundsLoading = false; state.roundsError = true; html = render(); expect(html).toContain(copy.en.tokenBalance.roundsError); expect(html).not.toContain(copy.en.tokenBalance.noRound);
});
