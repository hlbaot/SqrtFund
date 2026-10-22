import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { useProjects } from "@/hooks/useProjects";
import { Podium } from "@/components/leaderboard/Podium";
import { matchingValue, rankProjects } from "@/components/leaderboard/model";

const f = vi.hoisted(() => ({
  finalized: true, failedId: 0, previewFailure: false, payoutEnabled: false,
  payoutCalls: [] as { functionName: string; args: readonly bigint[]; address: string }[],
  retryPayouts: vi.fn(),
}));
const roundAddress = "0x2222222222222222222222222222222222222222";
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: "0x2222222222222222222222222222222222222222", finalized: f.finalized }) }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy.en, locale: "en" }) }; });
vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false }),
  useReadContract: () => ({ data: false }),
  useReadContracts: (options: { contracts: { functionName: string; args: readonly bigint[]; address: string }[]; query: { enabled: boolean } }) => {
    if (options.contracts[0]?.functionName === "payoutOf") {
      f.payoutEnabled = options.query.enabled; f.payoutCalls = options.contracts;
      return { data: [6_000_000n, 4_000_000n, 0n].map((result, i) => f.failedId === i + 1
        ? { status: "failure" } : { status: "success", result }), refetch: f.retryPayouts };
    }
    return { data: [
      { status: "success", result: [[4_000_000n, 5_000_000n, 0n].map((totalDonated, i) => ({
        id: BigInt(i + 1), name: `Project ${i + 1}`, owner: "0x1111111111111111111111111111111111111111",
        description: "Description", imageUrl: "", link: "", approved: true, rejected: false,
        claimed: true, totalDonated, sumSqrt: 0n, donorCount: BigInt(3 - i),
      })), 3n] },
      f.previewFailure ? { status: "failure" } : { status: "success", result: [[1n, 2n, 3n], [60_000_000n, 40_000_000n, 99_000_000n]] },
    ], refetch: vi.fn() };
  },
}));
function probe() {
  let result: ReturnType<typeof useProjects> | undefined;
  function Probe() { result = useProjects(roundAddress); return null; }
  renderToStaticMarkup(createElement(Probe));
  return result!;
}
beforeEach(() => { Object.assign(f, { finalized: true, failedId: 0, previewFailure: false, payoutEnabled: false }); vi.clearAllMocks(); });
it("passes recorded matching and totals from the shared project hook to all three podium cards", () => {
  const result = probe();
  expect(result.projects.map(project => [project.finalMatching, project.totalDonated + project.finalMatching!])).toEqual([[6, 10], [4, 9], [0, 0]]);
  expect(result.projects.map(project => project.finalMatchingRaw)).toEqual([6_000_000n, 4_000_000n, 0n]);
  expect(f.payoutCalls.map(call => [call.address, call.args])).toEqual([[roundAddress, [1n]], [roundAddress, [2n]], [roundAddress, [3n]]]);
  const html = renderToStaticMarkup(createElement(Podium, { projects: rankProjects(result.projects), roundId: roundAddress, pool: 20, finalized: true }));
  const cards = [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(match => match[0]);
  expect(cards).toHaveLength(3);
  expect(cards[0]).toContain('title="6"'); expect(cards[0]).toContain('title="10"');
  expect(cards[1]).toContain('title="4"'); expect(cards[1]).toContain('title="9"');
  expect(cards[2]).toContain('title="0"');
  expect(html).not.toContain("—");
});
it("keeps estimates for open rounds and does not expose cached payouts as final", () => {
  f.finalized = false;
  const { projects } = probe();
  expect(f.payoutEnabled).toBe(false);
  expect(projects.every(project => project.finalMatching === undefined)).toBe(true);
  expect(matchingValue(projects[0], false)).toBe(60);
});
it("does not replace a failed final read with an estimate or a fabricated zero", () => {
  f.failedId = 1;
  const { projects, refetch } = probe();
  expect(projects[0].estimatedMatching).toBe(60);
  expect(projects[0].finalMatching).toBeUndefined();
  expect(projects[1].finalMatching).toBe(4);
  expect(projects[2].finalMatching).toBe(0);
  refetch(); expect(f.retryPayouts).toHaveBeenCalledOnce();
});
it("still displays confirmed payouts if matching preview is unavailable", () => {
  f.previewFailure = true;
  expect(probe().projects.map(project => project.finalMatching)).toEqual([6, 4, 0]);
});
