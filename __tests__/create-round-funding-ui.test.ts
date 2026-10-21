import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";

const f = vi.hoisted(() => ({ locale: "vi" as "vi" | "en", depositForm: vi.fn(() => null) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy[f.locale], locale: f.locale }) }; });
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: true, address: "0x1111111111111111111111111111111111111111", chainId: 43113 }), usePublicClient: () => ({}), useWriteContract: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ refetch: vi.fn() }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({ balance: 100_000_000n, isReady: true }) }));
vi.mock("@/components/admin/DepositPoolForm", () => ({ DepositPoolForm: f.depositForm }));
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { DepositPoolButton } from "@/components/admin/DepositPoolButton";

it.each(["vi", "en"] as const)("includes optional initial funding and its transaction explanation in %s", locale => {
  f.locale = locale;
  const html = renderToStaticMarkup(createElement(CreateRoundForm));
  expect(html).toContain(copy[locale].admin.initialPoolLabel);
  expect(html).toContain(copy[locale].admin.initialPoolHint);
  expect(html).toContain('placeholder="0"');
});
it("renders top-up as a button and does not mount its form or queries before opening", () => {
  f.locale = "vi";
  const html = renderToStaticMarkup(createElement(DepositPoolButton));
  expect(html).toContain(copy.vi.admin.topUpRoundButton);
  expect(html).not.toContain(copy.vi.admin.depositAmountLabel);
  expect(f.depositForm).not.toHaveBeenCalled();
});
