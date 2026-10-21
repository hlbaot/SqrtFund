import { describe, expect, it } from "vitest";
import { calculateRoundFundingStats } from "@/lib/roundStats";

// Two donors contributing 1 USDC each generate exactly 2 USDC raw matching.
const approved = { approved: true, totalDonatedRaw: 2_000_000n, sumSqrtRaw: 2_000_000_000n };

describe("deposit pool financial summary", () => {
  it("has no demand or shortfall when there are no projects", () => {
    expect(calculateRoundFundingStats([], 0n)).toMatchObject({
      approvedCount: 0, pendingCount: 0, totalDonatedRaw: 0n, totalRaw: 0n,
      coverage: { underfunded: false, percent: "100.00" }, needed: 0n, suggestedDeposit: undefined,
    });
  });

  it.each([2_000_000n, 3_000_000n])("needs no deposit with sufficient pool %s", pool => {
    expect(calculateRoundFundingStats([approved], pool)).toMatchObject({
      totalRaw: 2_000_000n, needed: 0n, suggestedDeposit: undefined,
      coverage: { underfunded: false, percent: "100.00" },
    });
  });

  it("calculates a shortage from raw demand and rounds the suggested USDC up", () => {
    expect(calculateRoundFundingStats([approved], 999_999n)).toMatchObject({
      needed: 1_000_001n, suggestedDeposit: "2",
      coverage: { underfunded: true, percent: "49.99" },
    });
    expect(calculateRoundFundingStats([approved], 0n)).toMatchObject({
      needed: 2_000_000n, suggestedDeposit: "2", coverage: { percent: "0.00" },
    });
  });

  it("keeps raw coverage for a finalized round without offering a deposit", () => {
    expect(calculateRoundFundingStats([approved], 1_000_000n, true)).toMatchObject({
      totalRaw: 2_000_000n, needed: 1_000_000n, suggestedDeposit: undefined,
      coverage: { underfunded: true, percent: "50.00" },
    });
  });

  it("does not offer a deposit to a cancelled round", () => {
    expect(calculateRoundFundingStats([approved], 0n, false, true).suggestedDeposit).toBeUndefined();
  });

  it("counts pending separately and excludes pending and rejected donations and matching", () => {
    expect(calculateRoundFundingStats([
      approved, { ...approved, approved: false }, { ...approved, rejected: true },
    ], 1_000_000n)).toMatchObject({
      approvedCount: 1, pendingCount: 1, totalDonatedRaw: 2_000_000n, totalRaw: 2_000_000n,
    });
  });

  it("hides unavailable legacy data while retaining readable statistics", () => {
    expect(calculateRoundFundingStats([{ approved: true, totalDonatedRaw: 2_000_000n }], 0n)).toMatchObject({
      approvedCount: 1, totalDonatedRaw: 2_000_000n, totalRaw: undefined, coverage: undefined, needed: undefined,
    });
    expect(calculateRoundFundingStats([approved], undefined)).toMatchObject({
      totalRaw: 2_000_000n, coverage: undefined, needed: undefined, suggestedDeposit: undefined,
    });
    expect(calculateRoundFundingStats(undefined, 0n)).toMatchObject({
      approvedCount: undefined, pendingCount: undefined, totalDonatedRaw: undefined, totalRaw: undefined,
    });
  });
});
