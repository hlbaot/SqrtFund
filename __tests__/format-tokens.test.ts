import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatUsdcFixed,
  formatUsdcFull,
  formatDateTimeGmt7,
} from "../src/lib/format";

describe("Typography and number tokens format helpers", () => {
  describe("formatCount", () => {
    it("formats integer counts with thousands separators", () => {
      expect(formatCount(0)).toBe("0");
      expect(formatCount(5)).toBe("5");
      expect(formatCount(1234)).toBe("1,234");
      expect(formatCount(1000000)).toBe("1,000,000");
    });

    it("supports bigint counts", () => {
      expect(formatCount(0n)).toBe("0");
      expect(formatCount(1234567n)).toBe("1,234,567");
    });

    it("handles undefined or null gracefully", () => {
      expect(formatCount(undefined)).toBe("0");
      expect(formatCount(null)).toBe("0");
    });
  });

  describe("formatUsdcFixed", () => {
    it("always renders 2 decimals, with 0 shown as 0.00", () => {
      expect(formatUsdcFixed(0)).toBe("0.00 USDC");
      expect(formatUsdcFixed(0n)).toBe("0.00 USDC");
      expect(formatUsdcFixed(undefined)).toBe("0.00 USDC");
    });

    it("formats whole numbers with exactly 2 decimals and thousands separators", () => {
      expect(formatUsdcFixed(10)).toBe("10.00 USDC");
      expect(formatUsdcFixed(100)).toBe("100.00 USDC");
      expect(formatUsdcFixed(1000)).toBe("1,000.00 USDC");
      expect(formatUsdcFixed(1000000)).toBe("1,000,000.00 USDC");
    });

    it("formats decimal values rounded to 2 decimals", () => {
      expect(formatUsdcFixed(12.3)).toBe("12.30 USDC");
      expect(formatUsdcFixed(1234.567)).toBe("1,234.57 USDC");
      expect(formatUsdcFixed(99.999)).toBe("100.00 USDC");
    });

    it("supports raw bigint in 6 decimals", () => {
      expect(formatUsdcFixed(10_000_000n)).toBe("10.00 USDC");
      expect(formatUsdcFixed(1_234_560_000n)).toBe("1,234.56 USDC");
    });

    it("respects includeSymbol option", () => {
      expect(formatUsdcFixed(1000, { includeSymbol: false })).toBe("1,000.00");
      expect(formatUsdcFixed(0, { includeSymbol: false })).toBe("0.00");
    });
  });

  describe("formatUsdcFull", () => {
    it("renders full precision up to 6 decimals", () => {
      expect(formatUsdcFull(12.345678)).toBe("12.345678 USDC");
      expect(formatUsdcFull(0)).toBe("0.00 USDC");
      expect(formatUsdcFull(10)).toBe("10 USDC");
    });

    it("formats raw bigint with full decimals", () => {
      expect(formatUsdcFull(12_345_678n)).toBe("12.345678 USDC");
    });
  });

  describe("formatDateTimeGmt7", () => {
    it("formats ISO strings to DD/MM/YYYY HH:mm GMT+7", () => {
      // 2026-10-14T00:00:00Z is 07:00 in GMT+7
      const res = formatDateTimeGmt7("2026-10-14T00:00:00Z");
      expect(res).toBe("14/10/2026 07:00 GMT+7");
    });

    it("formats epoch second timestamps", () => {
      // 1700000000 is 2023-11-14T22:13:20Z -> 2023-11-15 05:13 in GMT+7
      const res = formatDateTimeGmt7(1700000000);
      expect(res).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} GMT\+7$/);
      expect(res).toContain("GMT+7");
    });

    it("formats Date objects", () => {
      const d = new Date("2026-01-01T12:30:00Z");
      const res = formatDateTimeGmt7(d);
      expect(res).toContain("GMT+7");
      expect(res).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} GMT\+7$/);
    });

    it("returns empty string for invalid dates", () => {
      expect(formatDateTimeGmt7("invalid-date")).toBe("");
      expect(formatDateTimeGmt7(undefined as unknown as string)).toBe("");
    });
  });
});
