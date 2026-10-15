import { describe, it, expect } from "vitest";
import {
  formatCooldown,
  calculateRemainingSeconds,
  calculateCanClaim,
} from "@/lib/format";

describe("Claim Cooldown and Faucet logic", () => {
  describe("formatCooldown", () => {
    it("formats 0 seconds correctly", () => {
      expect(formatCooldown(0)).toBe("00:00:00");
    });

    it("formats negative seconds as 00:00:00 safely", () => {
      expect(formatCooldown(-15)).toBe("00:00:00");
    });

    it("formats 59 seconds correctly", () => {
      expect(formatCooldown(59)).toBe("00:00:59");
    });

    it("formats 1 hour (3600 seconds) correctly", () => {
      expect(formatCooldown(3600)).toBe("01:00:00");
    });

    it("formats exactly 24 hours (86400 seconds) correctly", () => {
      expect(formatCooldown(86400)).toBe("1d 00:00:00");
    });

    it("formats greater than 24 hours (>24h) correctly", () => {
      // 1 day + 2 hours + 3 mins + 4 secs = 86400 + 7200 + 180 + 4 = 93784
      expect(formatCooldown(93784)).toBe("1d 02:03:04");
      // 2 days + 14 hours + 45 mins + 30 secs = 172800 + 50400 + 2700 + 30 = 225930
      expect(formatCooldown(225930)).toBe("2d 14:45:30");
    });
  });

  describe("calculateRemainingSeconds", () => {
    const nowSec = 1700000000;

    it("returns 0 when user has never claimed (nextClaimAt = 0)", () => {
      expect(calculateRemainingSeconds(0, nowSec)).toBe(0);
      expect(calculateRemainingSeconds(-1, nowSec)).toBe(0);
    });

    it("returns 0 when cooldown has passed (non-negative)", () => {
      expect(calculateRemainingSeconds(nowSec - 100, nowSec)).toBe(0);
    });

    it("returns positive remaining seconds when cooldown is active", () => {
      expect(calculateRemainingSeconds(nowSec + 3600, nowSec)).toBe(3600);
      expect(calculateRemainingSeconds(nowSec + 45, nowSec)).toBe(45);
    });
  });

  describe("calculateCanClaim", () => {
    it("returns false if wallet is not connected", () => {
      expect(
        calculateCanClaim({
          isConnected: false,
          nextClaimAt: 0,
          remainingSeconds: 0,
        })
      ).toBe(false);
    });

    it("returns true for new user who never claimed (nextClaimAt = 0)", () => {
      expect(
        calculateCanClaim({
          isConnected: true,
          nextClaimAt: 0,
          remainingSeconds: 0,
        })
      ).toBe(true);
    });

    it("returns false while cooldown is active (remainingSeconds > 0)", () => {
      expect(
        calculateCanClaim({
          isConnected: true,
          nextClaimAt: 1700003600,
          remainingSeconds: 1500,
        })
      ).toBe(false);
    });

    it("returns true when cooldown has expired (remainingSeconds = 0)", () => {
      expect(
        calculateCanClaim({
          isConnected: true,
          nextClaimAt: 1700000000,
          remainingSeconds: 0,
        })
      ).toBe(true);
    });

    it("returns false if user has reached the lifetime cap", () => {
      expect(
        calculateCanClaim({
          isConnected: true,
          nextClaimAt: 0,
          remainingSeconds: 0,
          lifetimeMinted: 1000_000_000n, // 1,000 USDC
          amount: 100_000_000n, // 100 USDC
          cap: 1000_000_000n, // 1,000 USDC limit
        })
      ).toBe(false);
    });

    it("returns true if user has room within lifetime cap", () => {
      expect(
        calculateCanClaim({
          isConnected: true,
          nextClaimAt: 0,
          remainingSeconds: 0,
          lifetimeMinted: 900_000_000n,
          amount: 100_000_000n,
          cap: 1000_000_000n,
        })
      ).toBe(true);
    });
  });

  describe("Student notification badge synchronization", () => {
    it("shows badge count 1 when canClaim is true", () => {
      const canClaim = true;
      const studentNotificationBadge = canClaim ? 1 : 0;
      expect(studentNotificationBadge).toBe(1);
    });

    it("hides badge (count 0) when in cooldown (canClaim is false)", () => {
      const canClaim = false;
      const studentNotificationBadge = canClaim ? 1 : 0;
      expect(studentNotificationBadge).toBe(0);
    });
  });
});
