import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { maxUint256 } from "viem";
import { copy } from "@/lib/copy";
import { DonateBox } from "@/components/project/DonateBox";

const f = vi.hoisted(() => ({ connected: true, input: "100", donated: 20_000_000n, legacy: false, balance: 500_000_000n }));
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => react.useState(initial === "1" ? f.input : initial === 1 ? Number(f.input) : initial) };
});
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: f.connected }),
  useReadContract: ({ functionName }: { functionName: string }) => ({ data: functionName === "donationOf" ? f.donated : 10_000_000n, refetch: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({
  roundAddress: "0x2222222222222222222222222222222222222222", token: "token", status: "open", pool: 200_000_000n,
  supportsPhase2: true, isCancelled: false, minDonation: f.legacy ? 1_000_000n : 1n,
  maxDonation: f.legacy ? 5_000_000n : maxUint256, maxPerRound: f.legacy ? 10_000_000n : maxUint256, maxMatchBps: 3000n, refetch: vi.fn(),
}) }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], refetch: vi.fn() }) }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isStudent: true, canParticipate: true }) }));
vi.mock("@/hooks/useDonate", () => ({ useDonate: () => ({ donate: vi.fn(), step: "idle", isPending: false, reset: vi.fn() }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({ balance: f.balance, isReady: true }) }));
vi.mock("@/lib/tokenBalance", () => ({ tokenMatchesConfigured: () => true }));
vi.mock("@/components/verify/DeferredStudentVerifyBox", () => ({ StudentVerifyBox: () => null }));
vi.mock("@/components/project/BatchDonationForm", () => ({ BatchDonationForm: () => null }));
vi.mock("@/components/layout/ConnectWalletButton", () => ({ ConnectWalletButton: () => createElement("button", null, "Kết nối ví") }));
vi.mock("@/lib/context/locale", () => ({ useLocale: () => ({ t: copy.vi, locale: "vi" }) }));

const project = { id: "1", name: "Project", roundId: "round", ownerAddress: "0x3333333333333333333333333333333333333333",
  status: "approved" as const, category: "technology" as const, shortDescription: "", description: "", contactUrl: "",
  supporterCount: 1, totalDonated: 20, estimatedMatching: 0, sumSqrtRaw: 0n, totalDonatedRaw: 20_000_000n };
const render = () => renderToStaticMarkup(createElement(DonateBox, { project }));
beforeEach(() => Object.assign(f, { connected: true, input: "100", donated: 0n, legacy: false, balance: 500_000_000n }));
it("requires wallet connection before showing donation controls even with cached account data", () => {
  f.connected = false;
  f.donated = 20_000_000n;
  const html = render();
  expect(html).toContain(copy.vi.common.walletRequired);
  expect(html).toContain(copy.vi.donateBox.notConnected);
  expect(html).toContain("<button");
  expect(html).not.toContain('disabled=""');
  expect(html).not.toContain('id="donation-amount"');
  expect(html).not.toContain(copy.vi.donateBox.alreadyDonatedTitle);
  f.connected = true;
  f.donated = 0n;
  expect(render()).toContain('id="donation-amount"');
});
it("lets a supporter contribute above 5 USDC without displaying a fake maximum or round budget, and blocks repeat contributions", () => {
  f.donated = 0n;
  const html = render();
  const input = html.match(/<input[^>]*id="donation-amount"[^>]*>/)?.[0];
  expect(input).toBeDefined();
  expect(input).toContain('value="100"');
  expect(input).not.toMatch(/\smax=/);
  expect(input).not.toContain('disabled=""');
  expect(html).not.toContain(maxUint256.toString());
  expect(html).not.toContain(copy.vi.donateBox.roundBudgetRemaining.split("{remaining}")[0]);

  // Once donated, repeat donations are blocked and alreadyDonated banner is displayed
  f.donated = 20_000_000n;
  const donatedHtml = render();
  expect(donatedHtml).toContain(copy.vi.donateBox.alreadyDonatedTitle);
  expect(donatedHtml).not.toContain('id="donation-amount"');
});
it("accepts micro-USDC and still blocks empty/zero or insufficient-balance contributions", () => {
  f.donated = 0n;
  f.input = "0.000001";
  expect(render()).not.toContain(copy.vi.donateBox.minMaxError);
  f.input = "0";
  expect(render()).toContain(copy.vi.donateBox.minMaxError);
  f.input = "501";
  expect(render()).toContain(copy.vi.donateBox.insufficientBalanceBtn.replace("{balance}", "500.00"));
});
it("retains the actual deployed bounds when opening an old round", () => {
  f.legacy = true; f.donated = 0n;
  const html = render();
  const input = html.match(/<input[^>]*id="donation-amount"[^>]*>/)?.[0];
  expect(input).toContain('min="1"');
  expect(input).toContain('max="5"');
});
