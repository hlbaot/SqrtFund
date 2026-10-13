import { describe, expect, it } from "vitest";
import {
  computeMatching,
  computeMatchingBigInt,
  computeRawMatching,
  sqrtBigInt,
  simulateDonationImpact,
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

  it("simulates donation impact correctly for DonateBox", () => {
    const pool = 100_000n * USDC;
    // Project has 1 donor with 2 USDC
    const initialSqrt = sqrtBigInt(2n * USDC * SCALE);
    const impact = simulateDonationImpact({
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

  it("backward-compatible wrapper computes expected values", () => {
    const [project] = computeMatching([{ id: "one", donations: { donor: 10 } }], 100);
    expect(project.raw).toBe(0);
    expect(project.matching).toBe(0);

    const [many] = computeMatching(
      [
        {
          id: "many",
          donations: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`d${i}`, 1])),
        },
      ],
      100,
    );
    expect(many.raw).toBeCloseTo(90, 0);
  });
});
