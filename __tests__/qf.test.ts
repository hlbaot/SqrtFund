import { describe, expect, it } from "vitest";
import {
  computeMatchingBigInt,
  computeRawMatching,
  sqrtBigInt,
  simulateDonationImpact,
  simulateDonationBatch,
  SCALE,
} from "../src/lib/qf";

describe("qf math (BigInt mirror of smart contracts)", () => {
  const USDC = 1_000_000n; // 1 USDC in 6 decimals

  it("sqrtBigInt matches floor integer square root", () => {
    expect(sqrtBigInt(0n)).toBe(0n);
    expect(sqrtBigInt(1n)).toBe(1n);
    expect(sqrtBigInt(4n)).toBe(2n);
    expect(sqrtBigInt(8n)).toBe(2n);
    expect(sqrtBigInt(9n)).toBe(3n);
    expect(sqrtBigInt(1_000_000_000_000_000_000n)).toBe(1_000_000_000n);
    expect(sqrtBigInt(5_000_000_000_000_000_000n)).toBe(2_236_067_977n);
  });

  it("300 donors x 1 USDC beats 60 donors x 5 USDC (same total of 300 USDC)", () => {
    // Project 1: 300 donors x 1 USDC
    const sqrt1 = sqrtBigInt(1n * USDC * SCALE); // sqrt(1e18) = 1e9
    const sumSqrt1 = 300n * sqrt1;
    const totalDonated1 = 300n * USDC;
    const raw1 = computeRawMatching(sumSqrt1, totalDonated1);

    // Project 2: 60 donors x 5 USDC
    const sqrt5 = sqrtBigInt(5n * USDC * SCALE);
    const sumSqrt2 = 60n * sqrt5;
    const totalDonated2 = 300n * USDC;
    const raw2 = computeRawMatching(sumSqrt2, totalDonated2);

    // raw1: 89,700 USDC (89,700,000,000 wei)
    // raw2: ~17,700 USDC (17,699,999,985 wei)
    expect(raw1).toBe(89_700n * USDC);
    expect(Number(raw2 / USDC)).toBeCloseTo(17_700, -2);
    expect(raw1).toBeGreaterThan(raw2);
  });

  it("1 donor giving 1+1+1 counts as sqrt(3), not 3; single donor yields 0 matching", () => {
    const sqrt3 = sqrtBigInt(3n * USDC * SCALE);
    const totalDonated = 3n * USDC;
    const raw = computeRawMatching(sqrt3, totalDonated);

    expect(raw).toBe(0n);
  });

  it("enforces matching cap (30%)", () => {
    const sqrt5 = sqrtBigInt(5n * USDC * SCALE);
    // 2 donors giving 5 USDC each
    const sumSqrt = 2n * sqrt5;
    const totalDonated = 10n * USDC;
    const pool = 10n * USDC;

    const results = computeMatchingBigInt(
      [{ id: "p1", sumSqrt, totalDonated }],
      pool,
      3000n, // 30%
    );

    // 30% of 10 USDC = 3 USDC
    expect(results[0].payout).toBe(3n * USDC);
  });

  it("simulates donation impact correctly for DonateBox matching by id", () => {
    const pool = 100_000n * USDC;
    // Project has 1 donor with 2 USDC
    const initialSqrt = sqrtBigInt(2n * USDC * SCALE);
    const impact = simulateDonationImpact({
      projectId: "p1",
      currentSumSqrt: initialSqrt,
      currentTotalDonated: 2n * USDC,
      donorCurrentTotal: 0n,
      donationAmount: 2n * USDC,
      allProjects: [{ id: "p1", sumSqrt: initialSqrt, totalDonated: 2n * USDC }],
      pool,
      maxMatchBps: 3000n,
    });

    expect(impact.currentPayout).toBe(0n); // 1 donor = 0 matching
    expect(impact.newPayout).toBeGreaterThan(0n); // 2nd donor brings matching!
    expect(impact.deltaPayout).toBe(impact.newPayout);
  });

  it("handles several projects competing for a small pool with pro-rata dilution", () => {
    // P1: 2 donors x 5 USDC = 10 USDC donated. Raw = (2 * sqrt(5e18))^2 / 1e12 - 10e6 = 20e6 - 10e6 = 10 USDC
    const sqrt5 = sqrtBigInt(5n * USDC * SCALE);
    const sumSqrt1 = 2n * sqrt5;
    const totalDonated1 = 10n * USDC;

    // P2: 2 donors x 2 USDC = 4 USDC donated. Raw = (2 * sqrt(2e18))^2 / 1e12 - 4e6 = 8e6 - 4e6 = 4 USDC
    const sqrt2 = sqrtBigInt(2n * USDC * SCALE);
    const sumSqrt2 = 2n * sqrt2;
    const totalDonated2 = 4n * USDC;

    // P3: 2 donors x 1 USDC = 2 USDC donated. Raw = (2 * sqrt(1e18))^2 / 1e12 - 2e6 = 4e6 - 2e6 = 2 USDC
    const sqrt1 = sqrtBigInt(1n * USDC * SCALE);
    const sumSqrt3 = 2n * sqrt1;
    const totalDonated3 = 2n * USDC;

    // Total raw matching = 10 + 4 + 2 = 16 USDC
    // Constrained pool = 8 USDC (< 16 USDC sumRaw)
    const smallPool = 8n * USDC;
    const allProjects = [
      { id: "p1", sumSqrt: sumSqrt1, totalDonated: totalDonated1 },
      { id: "p2", sumSqrt: sumSqrt2, totalDonated: totalDonated2 },
      { id: "p3", sumSqrt: sumSqrt3, totalDonated: totalDonated3 },
    ];

    const results = computeMatchingBigInt(allProjects, smallPool, 10000n);

    // P1 payout: (8 * 10) / 16 ~ 5 USDC
    expect(Number(results[0].payout) / 1_000_000).toBeCloseTo(5, 2);
    // P2 payout: (8 * 4) / 16 ~ 2 USDC (1_999_999n due to integer sqrt floor)
    expect(results[1].payout).toBe(1_999_999n);
    expect(Number(results[1].payout) / 1_000_000).toBeCloseTo(2, 2);
    // P3 payout: (8 * 2) / 16 ~ 1 USDC
    expect(results[2].payout).toBe(1_000_000n);

    // Sum of payouts must not exceed pool
    const totalPayout = results.reduce((acc, r) => acc + r.payout, 0n);
    expect(totalPayout).toBeLessThanOrEqual(smallPool);

    // Simulate marginal donation on P2 competing against P1 and P3
    const simulated = simulateDonationImpact({
      projectId: "p2",
      currentSumSqrt: sumSqrt2,
      currentTotalDonated: totalDonated2,
      donorCurrentTotal: 0n,
      donationAmount: 3n * USDC,
      allProjects,
      pool: smallPool,
      maxMatchBps: 10000n,
    });

    expect(simulated.currentPayout).toBe(1_999_999n);
    // P2 matching increases, but is diluted by the total pool constraint
    expect(simulated.newPayout).toBeGreaterThan(1_999_999n);
    expect(simulated.newPayout).toBeLessThanOrEqual(smallPool);
  });
});

 it("repeated contributions by one wallet never create another supporter in matching previews", () => {
   const initial = [{id:"1", sumSqrt:sqrtBigInt(3_000_000n * SCALE), totalDonated:3_000_000n}];
   const batch = simulateDonationBatch(initial, {"1":3_000_000n}, [{id:"1",amount:1_000_000n},{id:"1",amount:1_000_000n}],100_000_000n,10000n);
   const combined = simulateDonationBatch(initial,{"1":3_000_000n},[{id:"1",amount:2_000_000n}],100_000_000n,10000n);
   expect(batch).toEqual(combined);
   expect(batch[0].raw).toBe(0n);
   const single = simulateDonationImpact({projectId:"1",currentSumSqrt:initial[0].sumSqrt,currentTotalDonated:3_000_000n,donorCurrentTotal:3_000_000n,donationAmount:2_000_000n,allProjects:initial,pool:100_000_000n,maxMatchBps:10000n});
   expect(single.newPayout).toBe(0n);
   expect(single.totalRaw).toBe(0n);
 });
