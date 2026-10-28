// @vitest-environment jsdom
vi.mock("@/components/project/ContributionGuide", () => ({ ContributionGuide: () => null }));
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DonateBox } from "@/components/project/DonateBox";
import { BatchDonationForm } from "@/components/project/BatchDonationForm";
import { copy } from "@/lib/copy";
import type { Project } from "@/types";

const f = vi.hoisted(() => ({ donated: 3_000_000n as bigint | undefined, remaining: 7_000_000n, readError: false, step: "idle", wallet: "0x1111111111111111111111111111111111111111", donate: vi.fn(), many: vi.fn(), refresh: vi.fn(), reset: vi.fn() }));
const roundAddress = "0x2222222222222222222222222222222222222222";
const project = { id: "1", contractId: 1n, name: "Project A", roundId: roundAddress, ownerAddress: "0x3333333333333333333333333333333333333333", status: "approved", category: "technology", shortDescription: "", description: "", contactUrl: "", supporterCount: 1, totalDonated: 3, estimatedMatching: 0, sumSqrtRaw: 1_732_050_807n, totalDonatedRaw: 3_000_000n } as Project & { contractId: bigint; sumSqrtRaw: bigint; totalDonatedRaw: bigint };
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: f.wallet, isConnected: true, chainId: 43113 }),
  useReadContract: ({ functionName }: { functionName: string }) => ({ data: functionName === "donationOf" ? f.donated : f.remaining, isError: f.readError, refetch: f.refresh }),
  useReadContracts: () => ({ data: [{ status: f.readError ? "failure" : "success", result: f.donated }, { status: "success", result: 0n }], isError: f.readError }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: f.refresh }) }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: "0x2222222222222222222222222222222222222222", token: "token", status: "open", pool: 100_000_000n, supportsPhase2: true, minDonation: 1_000_000n, maxDonation: 5_000_000n, maxPerRound: 10_000_000n, maxMatchBps: 3000n, refetch: f.refresh }) }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ projects: [project, { ...project, id: "2", contractId: 2n, name: "Project B", totalDonatedRaw: 0n, sumSqrtRaw: 0n }], refetch: f.refresh }) }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ isStudent: true, canParticipate: true }) }));
vi.mock("@/hooks/useDonate", () => ({ useDonate: () => ({ donate: f.donate, donateMany: f.many, step: f.step, isPending: false, reset: f.reset }) }));
vi.mock("@/hooks/useTokenBalance", () => ({ useTokenBalance: () => ({ balance: 100_000_000n, isReady: true }) }));
vi.mock("@/lib/tokenBalance", () => ({ tokenMatchesConfigured: () => true }));
vi.mock("@/components/verify/DeferredStudentVerifyBox", () => ({ StudentVerifyBox: () => null }));
vi.mock("@/components/layout/ConnectWalletButton", () => ({ ConnectWalletButton: () => null }));
vi.mock("@/lib/context/locale", () => ({ useLocale: () => ({ t: copy.vi, locale: "vi" }) }));
let host: HTMLDivElement, root: Root;
const render = (batch = false) => act(async () => root.render(batch ? createElement(BatchDonationForm, { roundAddress, onBack: vi.fn() }) : createElement(DonateBox, { project, roundAddress })));
const button = (text: string) => [...host.querySelectorAll("button")].find(b => b.textContent?.includes(text))!;
async function fill(selector: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.clearAllMocks(); localStorage.clear();
  Object.assign(f, { donated: 3_000_000n, remaining: 7_000_000n, readError: false, step: "idle", wallet: "0x1111111111111111111111111111111111111111" });
  f.donate.mockResolvedValue(true); f.many.mockResolvedValue(true); f.refresh.mockResolvedValue(undefined);
  f.reset.mockImplementation(() => { f.step = "idle"; });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("submits a top-up, refreshes totals, and permits another explicit top-up until the cumulative cap", async () => {
  await render();
  await act(async () => button("Ủng hộ 1 USDC").click());
  expect(f.donate).toHaveBeenCalledWith(1n, 1_000_000n);
  expect(f.refresh).toHaveBeenCalled();
  f.donated = 4_000_000n; f.step = "success"; await render();
  await act(async () => button(copy.vi.donateBox.donateAgain).click());
  expect(f.reset).toHaveBeenCalledOnce(); await render();
  await act(async () => button("Ủng hộ 1 USDC").click());
  expect(f.donate).toHaveBeenCalledTimes(2);
  f.donated = 5_000_000n; await render();
  expect(host.querySelector<HTMLInputElement>("#donation-amount")!.disabled).toBe(true);
});
it.each([undefined, 3_000_000n])("blocks submission if contribution totals are unknown or errored (%s)", async total => {
  f.donated = total; f.readError = total !== undefined; await render();
  expect(host.querySelector<HTMLInputElement>("#donation-amount")!.disabled).toBe(true);
  expect(f.donate).not.toHaveBeenCalled();
});
it("blocks a single top-up beyond the remaining project allowance", async () => {
  await render(); await fill("#donation-amount", "3");
  expect(button("Ủng hộ 3 USDC").disabled).toBe(true);
  expect(f.donate).not.toHaveBeenCalled();
});
it("submits batch allocations for a previous donor and resets the allocation form", async () => {
  await render(true);
  await fill('input[aria-label$="Project A"]', "2");
  await fill('input[aria-label$="Project B"]', "1");
  expect(button(copy.vi.phase2.confirmDonation).disabled).toBe(false);
  await act(async () => button(copy.vi.phase2.confirmDonation).click());
  expect(f.many).toHaveBeenCalledWith([1n, 2n], [2_000_000n, 1_000_000n]);
  expect([...host.querySelectorAll("input")].every(i => i.value === "")).toBe(true);
});
it("enforces both cumulative project allowance and shared round budget in batch", async () => {
  await render(true); await fill('input[aria-label$="Project A"]', "3");
  expect(button(copy.vi.phase2.confirmDonation).disabled).toBe(true);
  await fill('input[aria-label$="Project A"]', "2");
  await fill('input[aria-label$="Project B"]', "2");
  f.remaining = 3_000_000n; await render(true);
  expect(button(copy.vi.phase2.confirmDonation).disabled).toBe(true);
  expect(f.many).not.toHaveBeenCalled();
});
it("fails closed on failed batch reads and prevents donating to one's own project", async () => {
  f.readError = true; await render(true);
  expect([...host.querySelectorAll("input")].every(i => i.disabled)).toBe(true);
  f.readError = false; f.wallet = project.ownerAddress!; await render(true);
  expect(host.querySelector<HTMLInputElement>('input[aria-label$="Project A"]')!.disabled).toBe(true);
});
it("clears batch allocations on a wallet change", async () => {
  await render(true); await fill('input[aria-label$="Project A"]', "2");
  f.wallet = "0x4444444444444444444444444444444444444444"; await render(true);
  expect([...host.querySelectorAll("input")].every(i => i.value === "")).toBe(true);
  expect(button(copy.vi.phase2.confirmDonation).disabled).toBe(true);
});
