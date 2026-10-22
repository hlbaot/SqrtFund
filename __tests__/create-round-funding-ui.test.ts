import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";

const f = vi.hoisted(() => ({ locale: "vi" as "vi" | "en", depositForm: vi.fn(() => null), supported: true, isUnsupported: false, credit: 0n, isOwner: true }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy[f.locale], locale: f.locale }) }; });
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: true, address: "0x1111111111111111111111111111111111111111", chainId: 43113 }), usePublicClient: () => ({}), useWriteContract: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ refetch: vi.fn() }) }));
vi.mock("@/hooks/useInitialPoolDeposit", () => ({ useInitialPoolDeposit: () => ({ supported: f.supported, isUnsupported: f.isUnsupported, credit: f.credit, isOwner: f.isOwner, canDeposit: f.isOwner, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({ balance: 100_000_000n, isReady: true }) }));
vi.mock("@/components/admin/DepositPoolForm", () => ({ DepositPoolForm: f.depositForm }));
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { DepositPoolButton } from "@/components/admin/DepositPoolButton";

beforeEach(() => Object.assign(f, { locale: "vi", supported: true, isUnsupported: false, credit: 0n, isOwner: true }));
it.each(["vi", "en"] as const)("requires a separate deposit before round creation in %s", locale => {
  f.locale = locale;
  const html = renderToStaticMarkup(createElement(CreateRoundForm));
  expect(html).toContain(copy[locale].admin.initialPoolLabel);
  expect(html).toContain(copy[locale].admin.initialPoolHint);
  expect(html).toContain('placeholder="0"');
  expect(html).toContain(copy[locale].admin.initialPoolDeposit);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/);
  expect(html).not.toContain(`${copy[locale].admin.initialPoolLabel} (${copy[locale].admin.optionalLabel})`);
});
it("shows on-chain credit and refund after reload, even when the depositor is no longer owner", () => {
  f.credit = 25_000_000n; f.isOwner = false;
  const html = renderToStaticMarkup(createElement(CreateRoundForm));
  expect(html).toContain("25");
  expect(html).toContain(copy.vi.admin.initialPoolWithdraw);
  expect(html).toContain(copy.vi.admin.initialPoolOwnerOnly);
});
it("blocks the new flow on old factories instead of falling back to create then deposit", () => {
  f.supported = false;
  const html = renderToStaticMarkup(createElement(CreateRoundForm));
  expect(html).toContain(copy.vi.admin.initialPoolUnavailable);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*type="submit"|<button[^>]*type="submit"[^>]*disabled=""/);
});
it("explains a required factory deployment instead of suggesting retry for a missing feature", () => {
  f.supported = false; f.isUnsupported = true;
  const html = renderToStaticMarkup(createElement(CreateRoundForm));
  expect(html).toContain(copy.vi.admin.initialPoolUpgradeRequired);
  expect(html).not.toContain(copy.vi.tokenBalance.retry);
});
it("renders top-up as a button and does not mount its form or queries before opening", () => {
  f.locale = "vi";
  const html = renderToStaticMarkup(createElement(DepositPoolButton));
  expect(html).toContain(copy.vi.admin.topUpRoundButton);
  expect(html).not.toContain(copy.vi.admin.depositAmountLabel);
  expect(f.depositForm).not.toHaveBeenCalled();
});
