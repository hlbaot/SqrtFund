// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { Project } from "@/types";
import { ProjectClaimPanel } from "@/components/project/ProjectClaimPanel";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { CLAIM_RECOMMENDATION_SECONDS } from "@/lib/claimWindow";
import type { RankedProject } from "@/components/leaderboard/model";
const f = vi.hoisted(() => ({ now: 0, claim: vi.fn(), finalizedAt: undefined as number | undefined }));
const wallet = `0x${"1".repeat(40)}`, round = `0x${"2".repeat(40)}` as const;
vi.mock("wagmi", () => ({ useAccount: () => ({ address: wallet, isConnected: true, chainId: 43113 }) }));
vi.mock("@/hooks/useClaim", () => ({ useClaim: () => ({ claim: f.claim, isPending: false }) }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => f.now }));
vi.mock("@/hooks/useClaimTiming", () => ({ useClaimTiming: () => ({ data: f.finalizedAt ? { finalizedAt: f.finalizedAt } : undefined }) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: "vi", t: copy.vi }) }; });
vi.mock("@/components/leaderboard/Podium", () => ({ Podium: ({ projects }: { projects: RankedProject[] }) => createElement("div", { "data-testid": "podium" }, projects.map(p => p.name).join(",")) }));
const project: Project = { id: "1", name: "Old project", roundId: round, ownerAddress: wallet, shortDescription: "Prototype", description: "Prototype", category: "technology", contactUrl: "", supporterCount: 10, totalDonated: 2, estimatedMatching: 9, finalMatching: 3, claimed: false, finalizedAt: 1000, status: "approved", fundingState: "finalized" };
let host: HTMLDivElement, root: Root;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("matchMedia", () => ({ matches: true })); f.now = 1000 + CLAIM_RECOMMENDATION_SECONDS + 1; f.finalizedAt = undefined; vi.clearAllMocks(); f.claim.mockResolvedValue(true); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("keeps the claim action enabled after the recommendation and preserves the payout", async () => {
  const onClaimed = vi.fn();
  await act(async () => root.render(createElement(ProjectClaimPanel, { project, round, finalized: true, cancelled: false, onClaimed })));
  expect(host.textContent).toContain("Quá hạn nhận kinh phí"); expect(host.textContent).toContain("5.00 USDC");
  expect(host.textContent).toContain("Bạn vẫn có thể claim muộn");
  const button = host.querySelector("button")!; expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(f.claim).toHaveBeenCalledWith(1n, round); expect(onClaimed).toHaveBeenCalledOnce();
});
it("does not invent a deadline when the event time is unavailable", async () => {
  await act(async () => root.render(createElement(ProjectClaimPanel, { project: { ...project, finalizedAt: undefined }, round, finalized: true, cancelled: false, onClaimed: vi.fn() })));
  expect(host.textContent).toContain("Chưa xác minh được thời điểm finalize");
  expect(host.textContent).not.toContain("Quá hạn nhận kinh phí");
  expect(host.querySelector("button")!.disabled).toBe(false);
});
it("moves overdue projects to the end of the default list without altering historical ranks and restores after claim", async () => {
  const other = { ...project, id: "2", name: "Claimed project", supporterCount: 2, claimed: true };
  const render = (claimed: boolean) => act(async () => root.render(createElement(Leaderboard, { projects: [{ ...project, claimed }, other], roundId: round, pool: 20, finalized: true, canDonate: false })));
  await render(false);
  expect(host.querySelector('[data-testid="podium"]')!.textContent).toBe("Claimed project");
  const rows = host.querySelectorAll("tbody tr"); expect(rows[0].textContent).toContain("Claimed project"); expect(rows[1].textContent).toContain("#1"); expect(rows[1].textContent).toContain("Old project");
  await render(true);
  expect(host.querySelector('[data-testid="podium"]')!.textContent).toContain("Old project");
  expect(host.querySelector("tbody tr")!.textContent).toContain("Old project");
  expect(host.textContent).not.toContain("Quá hạn nhận kinh phí");
});
