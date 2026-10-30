import { expect, it } from "vitest";
import { claimWindow, claimCountdown, isClaimOverdue, CLAIM_RECOMMENDATION_SECONDS, DAY_SECONDS } from "@/lib/claimWindow";
const project = { status: "approved" as const, fundingState: "finalized" as const, claimed: false, finalizedAt: 1000, totalDonated: 2, finalMatching: 4 };
const deadline = 1000 + CLAIM_RECOMMENDATION_SECONDS;
it.each([[8, "pending"], [7, "7d"], [3, "3d"], [1, "1d"], [0, "overdue"], [-1, "overdue"]] as const)("uses reminder stage %s days before the recommendation", (days, stage) => {
  expect(claimWindow(project, deadline - days * DAY_SECONDS)?.stage).toBe(stage);
});
it("keeps the recommendation tied to finalization rather than round end", () => {
  expect(claimWindow(project, 2000)?.deadline).toBe(deadline);
  expect(claimWindow({ ...project, finalizedAt: 2000 }, 2000)?.deadline).toBe(deadline + 1000);
});
it("never penalizes unknown, claimed, cancelled, unapproved or zero-payout projects", () => {
  for (const patch of [{ claimed: true }, { claimed: undefined }, { finalizedAt: undefined }, { finalizedAt: NaN }, { fundingState: "cancelled" as const }, { fundingState: "estimated" as const }, { status: "rejected" as const }, { finalMatching: undefined }, { totalDonated: 0, finalMatching: 0 }]) expect(isClaimOverdue({ ...project, ...patch }, deadline + 1)).toBe(false);
  expect(claimCountdown(undefined, deadline)).toBeUndefined();
  expect(claimWindow(project, 0)).toBeUndefined();
});
it("restores normal visibility immediately once claimed is confirmed", () => {
  expect(isClaimOverdue(project, deadline)).toBe(true);
  expect(isClaimOverdue({ ...project, claimed: true }, deadline)).toBe(false);
});
