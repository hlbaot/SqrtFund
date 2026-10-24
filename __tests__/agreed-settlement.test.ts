import { expect, it } from "vitest";
import { computeRoundAllocation, SCALE, sqrtBigInt } from "@/lib/qf";
import { calculateRoundSettlement } from "@/lib/roundStats";

const USDC = 1_000_000n;
// Mỗi dự án có hai ví khác nhau, mỗi ví góp 25 USDC: direct = 50, QF = 50.
const projects = ["A", "B", "C"].map(id => ({
  id, totalDonated: 50n * USDC, sumSqrt: 2n * sqrtBigInt(25n * USDC * SCALE),
}));

it.each([
  [3000n, 30_000_000n, 10_000_000n],
  [10000n, 33_333_333n, 1n],
])("conserves the 100 USDC pool and 150 USDC donations with cap %s", (cap, payout, leftover) => {
  const result = computeRoundAllocation(projects, 100n * USDC, cap);
  expect(result.allocations.map(p => p.raw)).toEqual([50n * USDC, 50n * USDC, 50n * USDC]);
  expect(result.allocations.map(p => p.payout)).toEqual([payout, payout, payout]);
  expect(result.leftover).toBe(leftover);
  expect(result.totalClaimable).toBe(150n * USDC + 3n * payout);
  expect(result.totalClaimable + result.leftover).toBe(250n * USDC);
  // Dashboard phải hiển thị cùng matching/pool dư với công thức, không trừ direct vào pool.
  const summary = calculateRoundSettlement(projects.map(p => ({
    approved: true, sumSqrtRaw: p.sumSqrt, totalDonatedRaw: p.totalDonated,
  })), 100n * USDC, cap);
  expect(summary.matching).toBe(3n * payout);
  expect(summary.leftover).toBe(leftover);
});

it("does not spend excess pool when raw QF demand is lower than the pool", () => {
  const result = computeRoundAllocation(projects, 300n * USDC, 10000n);
  expect(result.matching).toBe(150n * USDC);
  expect(result.leftover).toBe(150n * USDC);
});

it("keeps all pool as leftover when there are no approved projects", () => {
  expect(computeRoundAllocation([], 100n * USDC)).toMatchObject({ matching: 0n, direct: 0n, totalClaimable: 0n, leftover: 100n * USDC });
});
