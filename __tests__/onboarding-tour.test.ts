import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isTourCompleted, markTourCompleted, startOnboardingTour } from "@/lib/onboardingTour";
import { AutoOnboardingTour } from "@/components/onboarding/AutoOnboardingTour";

// Mock localStorage for node test environment
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, val: string) => { storage.set(key, String(val)); }),
  removeItem: vi.fn((key: string) => { storage.delete(key); }),
  clear: vi.fn(() => { storage.clear(); }),
};

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("window", {
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  localStorage: localStorageMock,
});

// Mock driver.js
const mockDriverInstance = {
  drive: vi.fn(),
  destroy: vi.fn(),
  hasNextStep: vi.fn().mockReturnValue(true),
  hasPrevStep: vi.fn().mockReturnValue(false),
};

const mockDriverFn = vi.fn().mockImplementation(() => mockDriverInstance);

vi.mock("driver.js", () => ({
  driver: (...args: unknown[]) => mockDriverFn(...args),
}));

vi.mock("@/lib/context/locale", () => ({
  useLocale: () => ({ locale: "vi", t: {} }),
}));

describe("Automatic Onboarding Tour via driver.js", () => {
  beforeEach(() => {
    storage.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    mockDriverFn.mockClear();
    mockDriverInstance.drive.mockClear();
  });

  it("identifies new user vs returning user via localStorage", () => {
    expect(isTourCompleted()).toBe(false);
    markTourCompleted();
    expect(isTourCompleted()).toBe(true);
  });

  it("initializes driver.js with Vietnamese copy and marks completed", async () => {
    await startOnboardingTour("vi");
    expect(mockDriverFn).toHaveBeenCalledTimes(1);
    expect(mockDriverInstance.drive).toHaveBeenCalledTimes(1);
    expect(isTourCompleted()).toBe(true);

    const config = mockDriverFn.mock.calls[0][0];
    expect(config.popoverClass).toBe("npower-tour-popover");
    expect(config.nextBtnText).toBe("Tiếp tục →");
    expect(config.prevBtnText).toBe("← Quay lại");
    expect(config.doneBtnText).toBe("Hoàn tất ✓");
    expect(config.showProgress).toBe(true);

    // Welcome step title
    expect(config.steps[0].popover.title).toContain("N-Power");
    expect(config.steps[0].popover.description).toContain("Quadratic Funding");

    // Element highlights without guide button
    const elementSelectors = config.steps.map((s: { element?: string }) => s.element).filter(Boolean);
    expect(elementSelectors).toContain("#tour-brand");
    expect(elementSelectors).toContain("#tour-nav");
    expect(elementSelectors).toContain("#tour-wallet");
    expect(elementSelectors).toContain("#tour-language");
    expect(elementSelectors).not.toContain("#tour-guide-btn");
  });

  it("initializes driver.js with English copy when locale is en", async () => {
    await startOnboardingTour("en");
    expect(mockDriverFn).toHaveBeenCalledTimes(1);

    const config = mockDriverFn.mock.calls[0][0];
    expect(config.nextBtnText).toBe("Next →");
    expect(config.prevBtnText).toBe("← Back");
    expect(config.doneBtnText).toBe("Done ✓");
    expect(config.steps[0].popover.title).toBe("Welcome to N-Power! 🎉");
  });

  it("renders AutoOnboardingTour silently as null without UI buttons", () => {
    const html = renderToStaticMarkup(createElement(AutoOnboardingTour));
    expect(html).toBe("");
  });
});
