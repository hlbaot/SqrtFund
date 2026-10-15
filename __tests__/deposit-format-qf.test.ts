import { describe, expect, it } from "vitest";
import { parseUsdc, formatUsdc } from "../src/lib/format";
import { computeMatchingBigInt, computeRawMatching, sqrtBigInt, SCALE } from "../src/lib/qf";
import { copy } from "../src/lib/copy";

describe("USDC parsing and formatting (bigint only)", () => {
  const USDC = 1_000_000n;

  it("accepts valid USDC amounts: 100, 1000, 100000, 0.000001, 1234567.123456", () => {
    // 100 USDC
    const res100 = parseUsdc("100");
    expect(res100.success).toBe(true);
    if (res100.success) {
      expect(res100.amount).toBe(100n * USDC);
      expect(typeof res100.amount).toBe("bigint");
    }

    // 1,000 USDC
    const res1k = parseUsdc("1000");
    expect(res1k.success).toBe(true);
    if (res1k.success) {
      expect(res1k.amount).toBe(1_000n * USDC);
    }

    // 100,000 USDC
    const res100k = parseUsdc("100000");
    expect(res100k.success).toBe(true);
    if (res100k.success) {
      expect(res100k.amount).toBe(100_000n * USDC);
    }

    // 0.000001 USDC (minimum precision: 1 wei)
    const resMin = parseUsdc("0.000001");
    expect(resMin.success).toBe(true);
    if (resMin.success) {
      expect(resMin.amount).toBe(1n);
    }

    // 1234567.123456 USDC
    const resComplex = parseUsdc("1234567.123456");
    expect(resComplex.success).toBe(true);
    if (resComplex.success) {
      expect(resComplex.amount).toBe(1_234_567_123_456n);
    }
  });

  it("rejects empty input", () => {
    expect(parseUsdc("").success).toBe(false);
    expect(parseUsdc("   ").success).toBe(false);
    const res = parseUsdc("");
    if (!res.success) {
      expect(res.errorKey).toBe("empty");
    }
  });

  it("rejects zero input", () => {
    const resZero = parseUsdc("0");
    expect(resZero.success).toBe(false);
    if (!resZero.success) expect(resZero.errorKey).toBe("zero");

    const resZeroDec = parseUsdc("0.000000");
    expect(resZeroDec.success).toBe(false);
    if (!resZeroDec.success) expect(resZeroDec.errorKey).toBe("zero");
  });

  it("rejects negative input", () => {
    const resNeg = parseUsdc("-100");
    expect(resNeg.success).toBe(false);
    if (!resNeg.success) expect(resNeg.errorKey).toBe("negative");

    const resNegSmall = parseUsdc("-0.000001");
    expect(resNegSmall.success).toBe(false);
    if (!resNegSmall.success) expect(resNegSmall.errorKey).toBe("negative");
  });

  it("rejects more than 6 decimal places", () => {
    const resTooMany = parseUsdc("1.1234567");
    expect(resTooMany.success).toBe(false);
    if (!resTooMany.success) expect(resTooMany.errorKey).toBe("too_many_decimals");

    const resSmallTooMany = parseUsdc("0.0000001");
    expect(resSmallTooMany.success).toBe(false);
    if (!resSmallTooMany.success) expect(resSmallTooMany.errorKey).toBe("too_many_decimals");
  });

  it("rejects non-numeric input", () => {
    const resAlpha = parseUsdc("abc");
    expect(resAlpha.success).toBe(false);
    if (!resAlpha.success) expect(resAlpha.errorKey).toBe("invalid_format");

    const resSuffix = parseUsdc("100usdc");
    expect(resSuffix.success).toBe(false);
    if (!resSuffix.success) expect(resSuffix.errorKey).toBe("invalid_format");

    const resMultiDot = parseUsdc("10.0.0");
    expect(resMultiDot.success).toBe(false);
    if (!resMultiDot.success) expect(resMultiDot.errorKey).toBe("invalid_format");

    const resSci = parseUsdc("1e6");
    expect(resSci.success).toBe(false);
    if (!resSci.success) expect(resSci.errorKey).toBe("invalid_format");
  });

  it("rejects amounts exceeding admin balance", () => {
    const adminBalance = 500n * USDC; // 500 USDC
    const resOk = parseUsdc("500", adminBalance);
    expect(resOk.success).toBe(true);

    const resExceed = parseUsdc("500.000001", adminBalance);
    expect(resExceed.success).toBe(false);
    if (!resExceed.success) {
      expect(resExceed.errorKey).toBe("exceeds_balance");
    }
  });

  it("formats large numbers with thousand separators and compact notation", () => {
    expect(formatUsdc(100n * USDC)).toBe("100 USDC");
    expect(formatUsdc(1_000n * USDC)).toBe("1,000 USDC");
    expect(formatUsdc(100_000n * USDC)).toBe("100,000 USDC");
    expect(formatUsdc(1_000_000n * USDC)).toBe("1,000,000 USDC");
    expect(formatUsdc(1_234_567_123_456n)).toBe("1,234,567.123456 USDC");

    // Compact mode
    expect(formatUsdc(100_000n * USDC, { compact: true })).toBe("100K USDC");
    expect(formatUsdc(1_000_000n * USDC, { compact: true })).toBe("1M USDC");
    expect(formatUsdc(1_500_000n * USDC, { compact: true })).toBe("1.5M USDC");
  });
});

describe("qf calculations with pool = 100,000 USDC (pure BigInt)", () => {
  const USDC = 1_000_000n;
  const pool = 100_000n * USDC; // 100,000 USDC matching pool = 100_000_000_000n

  it("allocates matching pool strictly under pool = 100,000 USDC using bigint only", () => {
    // Project A: 50 donors giving 5 USDC each
    // sumSqrt = 50 * sqrt(5 * 1e6 * 1e12) = 50 * 2236067977 = 111803398850
    const sqrt5 = sqrtBigInt(5n * USDC * SCALE);
    const sumSqrtA = 50n * sqrt5;
    const totalDonatedA = 50n * 5n * USDC; // 250 USDC

    // Project B: 200 donors giving 1 USDC each
    // sumSqrt = 200 * sqrt(1 * 1e6 * 1e12) = 200 * 1000000000 = 200000000000
    const sqrt1 = sqrtBigInt(1n * USDC * SCALE);
    const sumSqrtB = 200n * sqrt1;
    const totalDonatedB = 200n * 1n * USDC; // 200 USDC

    // Project C: 10 donors giving 2 USDC each
    const sqrt2 = sqrtBigInt(2n * USDC * SCALE);
    const sumSqrtC = 10n * sqrt2;
    const totalDonatedC = 10n * 2n * USDC; // 20 USDC

    const rawA = computeRawMatching(sumSqrtA, totalDonatedA);
    const rawB = computeRawMatching(sumSqrtB, totalDonatedB);
    const rawC = computeRawMatching(sumSqrtC, totalDonatedC);

    expect(typeof rawA).toBe("bigint");
    expect(typeof rawB).toBe("bigint");
    expect(typeof rawC).toBe("bigint");

    // Project B (200 supporters) has higher raw matching than Project A (50 supporters) despite lower direct donations
    expect(rawB).toBeGreaterThan(rawA);

    const projects = [
      { id: "projA", sumSqrt: sumSqrtA, totalDonated: totalDonatedA },
      { id: "projB", sumSqrt: sumSqrtB, totalDonated: totalDonatedB },
      { id: "projC", sumSqrt: sumSqrtC, totalDonated: totalDonatedC },
    ];

    const maxMatchBps = 3000n; // 30% cap
    const results = computeMatchingBigInt(projects, pool, maxMatchBps);

    expect(results.length).toBe(3);

    let totalPayout = 0n;
    const cap = (pool * maxMatchBps) / 10000n; // 30,000 USDC

    for (const res of results) {
      expect(typeof res.payout).toBe("bigint");
      expect(res.payout).toBeGreaterThan(0n);
      expect(res.payout).toBeLessThanOrEqual(cap);
      totalPayout += res.payout;
    }

    expect(totalPayout).toBeLessThanOrEqual(pool);
    const leftover = pool - totalPayout;
    expect(leftover).toBeGreaterThanOrEqual(0n);
    expect(typeof leftover).toBe("bigint");
  });

  it("handles pool scaling pro-rata when unconstrained without exceeding pool", () => {
    // 5 projects with massive raw matching
    const sqrt5 = sqrtBigInt(5n * USDC * SCALE);
    const projects = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i + 1}`,
      sumSqrt: 500n * sqrt5,
      totalDonated: 500n * 5n * USDC,
    }));

    // 100% maxMatchBps (no individual cap, purely pro-rata)
    const results = computeMatchingBigInt(projects, pool, 10000n);
    let totalPayout = 0n;
    for (const res of results) {
      expect(typeof res.payout).toBe("bigint");
      totalPayout += res.payout;
    }

    expect(totalPayout).toBeLessThanOrEqual(pool);
  });
});

describe("EN/VI copy parity for deposit and minting", () => {
  it("has all required copy keys in both English and Vietnamese", () => {
    const keys = [
      "depositPoolTitle",
      "depositPoolDesc",
      "depositAmountLabel",
      "depositBtn",
      "currentPoolLabel",
      "adminBalanceLabel",
      "maxBtn",
      "confirmDepositTitle",
      "confirmDepositNotice",
      "warningLargeDepositTitle",
      "warningLargeAmountZeros",
      "disabledFinalizedExplanation",
      "disabledWrongNetworkExplanation",
      "disabledNoBalanceExplanation",
      "disabledNotAdminExplanation",
      "mintTestUsdcTitle",
      "mintTestUsdcDesc",
      "mintRecipientLabel",
      "mintAmountLabel",
      "mintBtn",
      "confirmMintTitle",
      "confirmMintNotice",
      "validationEmptyAmount",
      "validationNegativeAmount",
      "validationZeroAmount",
      "validationTooManyDecimals",
      "validationInvalidAmount",
      "validationExceedsBalance",
    ] as const;

    for (const key of keys) {
      expect(copy.en.admin[key], `Missing en.admin.${key}`).toBeDefined();
      expect(typeof copy.en.admin[key]).toBe("string");
      expect(copy.en.admin[key].length).toBeGreaterThan(0);

      expect(copy.vi.admin[key], `Missing vi.admin.${key}`).toBeDefined();
      expect(typeof copy.vi.admin[key]).toBe("string");
      expect(copy.vi.admin[key].length).toBeGreaterThan(0);
    }
  });
});
