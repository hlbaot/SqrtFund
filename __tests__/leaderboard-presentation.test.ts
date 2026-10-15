import { describe, expect, it } from "vitest";
import { displayNumber, matchingValue, rankProjects, roundDate, sortProjects, type LeaderboardProject } from "../src/components/leaderboard/model";

const project = (id: string, supporters: number, direct: number): LeaderboardProject => ({ id, supporterCount: supporters, totalDonated: direct, estimatedMatching: direct * 2, name: id, description: "", shortDescription: "", ownerAddress: "0xabc", roundId: "0xdef", contactUrl: "", category: "technology", status: "approved" });
describe("leaderboard presentation", () => {
  it("assigns competition ranks and ties without mutating the source", () => {
    const input = [project("4", 0, 100), project("3", 8, 3), project("1", 10, 1), project("2", 8, 2)];
    const ranked = rankProjects(input);
    expect(ranked.map(p => [p.id, p.supporterRank, p.tied])).toEqual([["1", 1, false], ["2", 2, true], ["3", 2, true], ["4", 4, false]]);
    expect(input[0].id).toBe("4");
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
