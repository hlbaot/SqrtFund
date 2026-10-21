import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { copy } from "@/lib/copy";
import { calculateRoundSettlement } from "@/lib/roundStats";
import { usdcAddress } from "@/lib/contracts/addresses";

const f = vi.hoisted(() => ({
  now: 1000, wallet: "0x1111111111111111111111111111111111111111", connected: true, chainId: 43113,
  locale: "vi" as "vi" | "en", write: vi.fn(), receipt: vi.fn(), invalidate: vi.fn(), success: vi.fn(),
  click: new Map<string, () => void>(),
}));
vi.mock("@/lib/contracts/addresses", async original => ({ ...await original<typeof import("@/lib/contracts/addresses")>(), usdcAddress: "0x5555555555555555555555555555555555555555", TARGET_CHAIN_ID: 43113 }));
vi.mock("wagmi", () => ({ useAccount: () => ({ address: f.wallet, isConnected: f.connected, chainId: f.chainId }), usePublicClient: () => ({ waitForTransactionReceipt: f.receipt }), useWriteContract: () => ({ writeContractAsync: f.write }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: f.invalidate }) }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => f.now }));
vi.mock("@/hooks/useTxFlow", () => ({ useTxFlow: () => () => ({ cancelled: false, wait: (run: () => Promise<unknown>) => run(), finish: vi.fn(), error: vi.fn(), toast: { pending: vi.fn(), success: f.success } }) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy[f.locale], locale: f.locale }) }; });
vi.mock("@/components/ui/Dialog", () => ({ Dialog: ({ isOpen, children }: { isOpen: boolean; children: import("react").ReactNode }) => isOpen ? createElement("div", { role: "dialog" }, children) : null }));
vi.mock("@/components/ui/Button", async original => {
  const { Button } = await original<typeof import("@/components/ui/Button")>();
  return { Button: (props: ComponentProps<typeof Button>) => {
    const label = props["aria-label"];
    if (label && props.onClick) f.click.set(label, () => props.onClick!({} as import("react").MouseEvent<HTMLButtonElement>));
    return createElement(Button, props);
  } };
});
vi.mock("@/components/admin/DepositPoolButton", () => ({ DepositPoolButton: ({ label }: { label: string }) => createElement("button", { type: "button" }, label) }));
import { RoundControls } from "@/components/admin/RoundControls";
import { FinalizeButton } from "@/components/admin/FinalizeButton";
import { CountdownTimer } from "@/components/round/CountdownTimer";

type ControlProps = ComponentProps<typeof RoundControls>;
const admin = "0x1111111111111111111111111111111111111111";
const roundAddress = "0x2222222222222222222222222222222222222222";
let round: ControlProps["round"];
const projects = [{ id: "1", approved: true, sumSqrtRaw: 2_000_000_000n, totalDonatedRaw: 2_000_000n, claimed: false }] as ControlProps["projects"];
const c = copy.vi.roundControls;
beforeEach(() => {
  vi.clearAllMocks(); f.click.clear();
  Object.assign(f, { now: 1000, wallet: admin, connected: true, chainId: 43113, locale: "vi" });
  round = {
    roundAddress, allRounds: [roundAddress], admin, token: usdcAddress, name: "Selected round", startTime: 500n, endTime: 2000n,
    finalized: false, isCancelled: false, supportsPhase2: true, pool: 1_000_000n, maxMatchBps: 3000n,
    leftover: 700_000n, leftoverWithdrawn: false, cancelledPoolWithdrawn: false,
    financials: { pool: 1_000_000n, leftover: 700_000n, status: "open" }, refetch: vi.fn(), isLoading: false, isError: false,
    factoryOwner: undefined, organizer: undefined, minDonation: 1n, maxDonation: 5n, maxPerRound: 10n,
    projectCount: 1n, status: "open", studentRegistry: undefined, readFailureKind: "rpc", roundVersion: "current",
  };
  f.write.mockResolvedValue("0x123"); f.receipt.mockResolvedValue({ status: "success" }); f.invalidate.mockResolvedValue(undefined);
});
const render = () => renderToStaticMarkup(createElement(RoundControls, { round, projects, projectsLoading: false, onSelectRound: vi.fn() }));
const labels = (html: string) => [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(match => match[1].replace(/<[^>]+>/g, "").trim());

it("only renders available controls and no faded finalize button before the end", () => {
  const html = render();
  expect(labels(html)).toContain(c.deposit); expect(labels(html)).toContain(c.cancel);
  expect(labels(html)).not.toContain(c.finalize);
  expect(html).not.toContain(copy.vi.admin.gracePeriodNotice);
  expect(html).toContain(c.endsIn); expect(html).toContain('aria-current="step"');
});
it("shows a short opening countdown before start and safely handles legacy missing dates", () => {
  round.startTime = 1500n;
  expect(render()).toContain(c.opensIn); expect(labels(render())).not.toContain(c.finalize);
  round.endTime = undefined;
  expect(render()).toContain(c.scheduleUnavailable); expect(render()).not.toContain("NaN");
  expect(labels(render())).not.toContain(c.finalize);
});
it("keeps countdown rendering deterministic and preserves known terminal status before hydration", () => {
  f.now = 0;
  expect(renderToStaticMarkup(createElement(CountdownTimer, { endTime: 2000n, inline: true }))).toContain("—");
  expect(renderToStaticMarkup(createElement(CountdownTimer, { endTime: 2000n, statusOverride: "finalized" }))).toContain(copy.vi.competition.finalized);
  f.now = 1000;
  const html = renderToStaticMarkup(createElement(CountdownTimer, { endTime: 2000n, inline: true }));
  expect(html).not.toContain("NaN"); expect(html).toContain("16");
});
it("crosses the grace boundary using the live clock and only shows public finalization after grace", () => {
  f.now = 2000; expect(labels(render())).toContain(c.finalize);
  f.wallet = "0x3333333333333333333333333333333333333333";
  expect(labels(render())).not.toContain(c.finalize); expect(render()).toContain(c.adminOnlyRemaining);
  f.now = 88400;
  expect(labels(render())).toEqual([c.finalize]);
  expect(render()).toContain(c.everyoneCanFinalize);
});
it("only shows final results and a valid leftover withdrawal after finalization", () => {
  round.finalized = true;
  const html = render();
  expect(labels(html)).toEqual([c.withdrawLeftover]);
  expect(html).toContain(c.allocatedMatching); expect(html).toContain("0.3 USDC");
  expect(html).toContain(c.matchingProjects);
  round.leftoverWithdrawn = true;
  expect(labels(render())).toEqual([]); expect(render()).toContain(c.leftoverWithdrawn);
});
it("replaces the stepper with cancellation guidance and hides all obsolete actions", () => {
  round.isCancelled = true;
  const html = render();
  expect(labels(html)).toEqual([c.withdrawPool]); expect(html).toContain(c.refundHint);
  expect(html).not.toContain('aria-label="' + c.progress + '"');
  round.cancelledPoolWithdrawn = true;
  expect(labels(render())).toEqual([]); expect(render()).toContain(c.poolWithdrawn);
});
it("never exposes admin recovery controls to a different wallet or wrong chain", () => {
  round.finalized = true; f.wallet = "0x3333333333333333333333333333333333333333";
  expect(labels(render())).toEqual([]);
  round.finalized = false; round.isCancelled = true;
  expect(labels(render())).toEqual([]);
  round.isCancelled = false; f.now = 88400; f.chainId = 1;
  expect(labels(render())).toEqual([]);
});
it("refreshes shared data immediately after withdrawal and keeps the Snowtrace toast hash", async () => {
  round.finalized = true; render();
  f.click.get(c.withdrawLeftover)!();
  await vi.waitFor(() => expect(f.invalidate).toHaveBeenCalledTimes(1));
  expect(f.write).toHaveBeenCalledWith(expect.objectContaining({ address: roundAddress, functionName: "withdrawLeftover", chainId: 43113 }));
  expect(round.refetch).toHaveBeenCalled(); expect(f.success).toHaveBeenCalledWith("withdrawLeftover", copy.vi.toasts.withdrawSuccess, undefined, "0x123");
  round.leftoverWithdrawn = true;
  expect(labels(render())).toEqual([]);
});
it.each(["vi", "en"] as const)("shows the finalization estimate, capped matching, leftover and underfunded warning in %s", locale => {
  f.locale = locale;
  const t = copy[locale];
  const html = renderToStaticMarkup(createElement(FinalizeButton, {
    allowed: true, pending: false, disabled: false, open: true, onOpen: vi.fn(), onClose: vi.fn(), onConfirm: vi.fn(),
    summary: calculateRoundSettlement(projects, 1_000_000n, 3000n), pool: 1_000_000n, statsReady: true,
  }));
  for (const label of [t.roundControls.pool, t.roundControls.donations, t.roundControls.estimatedMatching, t.roundControls.estimatedLeftover]) expect(html).toContain(label);
  expect(html).toContain("50.00%"); expect(html).toContain("0.3 USDC"); expect(html).toContain("0.7 USDC");
  expect(html).toContain(t.roundControls.finalizeWarning);
});
