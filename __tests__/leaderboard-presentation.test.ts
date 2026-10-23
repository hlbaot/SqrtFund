import { describe, expect, it } from "vitest";
import { displayNumber, matchingValue, rankProjects, roundDate, sortProjects, type LeaderboardProject } from "../src/components/leaderboard/model";

const project = (id: string, supporters: number, direct: number): LeaderboardProject => ({ id, supporterCount: supporters, totalDonated: direct, estimatedMatching: direct * 2, name: id, description: "", shortDescription: "", ownerAddress: "0xabc", roundId: "0xdef", contactUrl: "", category: "technology", status: "approved" });
describe("leaderboard presentation", () => {
  it("breaks equal supporter counts by direct money without mutating the source", () => {
    const input = [project("4", 0, 100), project("3", 8, 3), project("1", 10, 1), project("2", 8, 2)];
    const ranked = rankProjects(input);
    expect(ranked.map(p => [p.id, p.supporterRank, p.tied])).toEqual([["1", 1, false], ["3", 2, false], ["2", 3, false], ["4", 4, false]]);
    expect(input[0].id).toBe("4");
  });
  it("uses direct USDC when both supporters and uncapped QF scores tie", () => {
    const a = { ...project("1", 10, 10), sumSqrtRaw: 10_000_000_000n, totalDonatedRaw: 10_000_000n };
    const b = { ...project("2", 10, 31), sumSqrtRaw: 11_000_000_000n, totalDonatedRaw: 31_000_000n };
    const ranked = rankProjects([a, b, { ...a, id: "3", supporterCount: 8 }]);
    expect(ranked.map(p => [p.id, p.supporterRank, p.tied])).toEqual([["2", 1, false], ["1", 2, false], ["3", 3, false]]);
  });
  it("keeps raw QF ahead of money, independently of capped matching payouts", () => {
    const a = { ...project("1", 10, 10), sumSqrtRaw: 10_000_000_000n, totalDonatedRaw: 10_000_000n, estimatedMatching: 30 };
    const b = { ...project("2", 10, 31), sumSqrtRaw: 10_000_000_000n, totalDonatedRaw: 31_000_000n, estimatedMatching: 30 };
    expect(rankProjects([b, a]).map(p => p.id)).toEqual(["1", "2"]);
  });
  it("shares a rank only when all criteria tie and orders those projects by numeric ID", () => {
    const a = { ...project("10", 10, 10), sumSqrtRaw: 10_000_000_000n, totalDonatedRaw: 10_000_000n };
    expect(rankProjects([a, { ...a, id: "2" }, { ...a, id: "3", supporterCount: 8 }])
      .map(p => [p.id, p.supporterRank, p.tied])).toEqual([["2", 1, true], ["10", 1, true], ["3", 3, false]]);
  });
  it("compares one micro-USDC exactly even above Number's safe integer limit", () => {
    const a = { ...project("1", 10, 1), sumSqrtRaw: 0n, totalDonatedRaw: 9_007_199_254_740_992n };
    const b = { ...a, id: "2", totalDonatedRaw: a.totalDonatedRaw + 1n };
    expect(rankProjects([a, b]).map(p => [p.id, p.supporterRank])).toEqual([["2", 1], ["1", 2]]);
  });
  it("preserves supporter ranks when sorting by direct or matching", () => {
    const ranked = rankProjects([project("1", 10, 1), project("2", 5, 100)]);
    for (const sort of ["direct", "matching"] as const) expect(sortProjects(ranked, sort, false).map(p => [p.id, p.supporterRank])).toEqual([["2", 2], ["1", 1]]);
  });
  it("never presents estimates as finalized payouts", () => {
    const item = project("1", 3, 10);
    expect(matchingValue(item, false)).toBe(20);
    expect(matchingValue(item, true)).toBeUndefined();
    expect(matchingValue({ ...item, finalMatching: 0 }, true)).toBe(0);
  });
  it("uses final matching for final sorting and puts unavailable payouts last", () => {
    const ranked = rankProjects([{ ...project("1", 10, 5), finalMatching: 2 }, { ...project("2", 8, 2), finalMatching: 20 }, project("3", 1, 100)]);
    expect(sortProjects(ranked, "matching", true).map(p => p.id)).toEqual(["2", "1", "3"]);
  });
  it("formats six decimal places and dates in GMT+7 for both locales", () => {
    expect(displayNumber(1000000.123456, "en")).toBe("1,000,000.123456");
    expect(displayNumber(1000000.123456, "vi")).toBe("1.000.000,123456");
    for (const locale of ["en", "vi"] as const) expect(roundDate("2026-10-15T00:00:00Z", locale)).toContain("07:00");
  });
});
