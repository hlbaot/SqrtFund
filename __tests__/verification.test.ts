import { describe, it, expect } from "vitest";
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

  describe("Verification status mapping logic", () => {
    type VerificationStatus = "none" | "pending" | "approved" | "rejected";

    function getVerificationUiState(status: VerificationStatus, isStudentOrAdmin: boolean) {
      if (isStudentOrAdmin || status === "approved") {
        return { showBlock: false };
      }
      switch (status) {
        case "none":
          return {
            showBlock: true,
            canSubmit: true,
            actionLabel: "REQUEST VERIFICATION",
            chip: null,
          };
        case "pending":
          return {
            showBlock: true,
            canSubmit: false,
            actionLabel: null,
            chip: "PENDING APPROVAL",
          };
        case "rejected":
          return {
            showBlock: true,
            canSubmit: true,
            actionLabel: "REQUEST AGAIN",
            chip: "REJECTED",
          };
      }
    }

    it("hides verification block for students or admins", () => {
      expect(getVerificationUiState("none", true).showBlock).toBe(false);
      expect(getVerificationUiState("approved", false).showBlock).toBe(false);
    });

    it("renders submit action for new guest with status none", () => {
      const state = getVerificationUiState("none", false);
      expect(state.showBlock).toBe(true);
      expect(state.canSubmit).toBe(true);
      expect(state.actionLabel).toBe("REQUEST VERIFICATION");
    });

    it("renders pending chip and disables submit for status pending", () => {
      const state = getVerificationUiState("pending", false);
      expect(state.showBlock).toBe(true);
      expect(state.canSubmit).toBe(false);
      expect(state.chip).toBe("PENDING APPROVAL");
    });

    it("renders rejected chip and allows request again for status rejected", () => {
      const state = getVerificationUiState("rejected", false);
      expect(state.showBlock).toBe(true);
      expect(state.canSubmit).toBe(true);
      expect(state.actionLabel).toBe("REQUEST AGAIN");
      expect(state.chip).toBe("REJECTED");
    });
  });
});
