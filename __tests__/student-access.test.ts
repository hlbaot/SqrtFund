import { expect, it } from "vitest";
import { donationLimit, remainingBudget, studentCanParticipate } from "@/lib/studentAccess";
it("gates participation on connected global identity and the shared registry", () => {
  expect(studentCanParticipate(true, true, true)).toBe(true);
  expect(studentCanParticipate(false, true, true)).toBe(false);
  expect(studentCanParticipate(true, false, true)).toBe(false);
  expect(studentCanParticipate(true, true, false)).toBe(false);
});
it("checks cumulative project and round limits at six-decimal boundaries", () => {
  expect(donationLimit(1_000_001n, 1n, 5_000_000n, 3_999_999n, 1_000_001n)).toBeNull();
  expect(donationLimit(1_000_002n, 1n, 5_000_000n, 3_999_999n, 2_000_000n)).toBe("project");
  expect(donationLimit(1_000_002n, 1n, 5_000_000n, 0n, 1_000_001n)).toBe("round");
  expect(donationLimit(0n, 1n, 5n, 0n, 5n)).toBe("minimum");
});
it("exhausts a budget and starts a fresh round independently", () => {
  expect(remainingBudget(10n, 10n)).toBe(0n);
  expect(remainingBudget(10n, 11n)).toBe(0n);
  expect(remainingBudget(10n, 0n)).toBe(10n);
});
