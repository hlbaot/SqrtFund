import { describe, it, expect } from "vitest";
import { verificationStatus } from "@/lib/verification";
import { shortAddress, getExplorerAddressUrl, formatTimeAgo } from "@/lib/format";

describe("Verification Formatting and UI helpers", () => {
  const sampleAddr = "0x32D91234567890abcdef1234567890abcdefF9B7";

  it("shortens address correctly with default 4 chars", () => {
    const shortened = shortAddress(sampleAddr);
    expect(shortened).toBe("0x32D9...F9B7");
  });

  it("generates correct Snowtrace testnet address explorer url", () => {
    const url = getExplorerAddressUrl(sampleAddr);
    expect(url).toBe(`https://testnet.snowtrace.io/address/${sampleAddr}`);
  });

  describe("formatTimeAgo", () => {
    const now = 1700000000000;

    it("formats just now for under 1 minute", () => {
      expect(formatTimeAgo(now - 30 * 1000, "en", now)).toBe("just now");
      expect(formatTimeAgo(now - 30 * 1000, "vi", now)).toBe("vừa xong");
    });

    it("formats minutes ago", () => {
      expect(formatTimeAgo(now - 5 * 60 * 1000, "en", now)).toBe("5 minutes ago");
      expect(formatTimeAgo(now - 5 * 60 * 1000, "vi", now)).toBe("5 phút trước");
      expect(formatTimeAgo(now - 1 * 60 * 1000, "en", now)).toBe("1 minute ago");
      expect(formatTimeAgo(now - 1 * 60 * 1000, "vi", now)).toBe("1 phút trước");
    });

    it("formats hours ago", () => {
      expect(formatTimeAgo(now - 2 * 3600 * 1000, "en", now)).toBe("2 hours ago");
      expect(formatTimeAgo(now - 2 * 3600 * 1000, "vi", now)).toBe("2 giờ trước");
      expect(formatTimeAgo(now - 1 * 3600 * 1000, "en", now)).toBe("1 hour ago");
    });

    it("formats days ago", () => {
      expect(formatTimeAgo(now - 3 * 86400 * 1000, "en", now)).toBe("3 days ago");
      expect(formatTimeAgo(now - 3 * 86400 * 1000, "vi", now)).toBe("3 ngày trước");
      expect(formatTimeAgo(now - 1 * 86400 * 1000, "en", now)).toBe("1 day ago");
    });
  });

  describe("on-chain verification status", () => {
    it("maps a fresh wallet to none and an on-chain false decision to rejected", () => {
      expect(verificationStatus(false, false)).toBe("none");
      expect(verificationStatus(false, false, false)).toBe("rejected");
    });
    it("prioritizes live whitelist and pending state over old rejection events", () => {
      expect(verificationStatus(true, false, false)).toBe("approved");
      expect(verificationStatus(false, true, false)).toBe("pending");
    });
  });
});
