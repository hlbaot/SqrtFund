import type { Project } from "@/types";
export const DAY_SECONDS = 86400;
export const CLAIM_RECOMMENDATION_SECONDS = 30 * DAY_SECONDS;
export type ClaimStage = "pending" | "7d" | "3d" | "1d" | "overdue";
export function claimWindow(project: Pick<Project, "status" | "fundingState" | "claimed" | "finalizedAt" | "totalDonated" | "finalMatching">, now: number) {
  if (project.status !== "approved" || project.fundingState !== "finalized" || project.claimed !== false || project.finalMatching === undefined || !Number.isFinite(project.finalMatching) || !Number.isFinite(project.totalDonated) || project.finalMatching < 0 || project.totalDonated < 0 || project.totalDonated + project.finalMatching <= 0 || !Number.isSafeInteger(project.finalizedAt) || project.finalizedAt! <= 0 || now <= 0) return undefined;
  return claimCountdown(project.finalizedAt, now);
}
export function claimCountdown(finalizedAt: number | undefined, now: number) {
  if (!Number.isSafeInteger(finalizedAt) || finalizedAt! <= 0 || now <= 0) return undefined;
  const deadline = finalizedAt! + CLAIM_RECOMMENDATION_SECONDS;
  const remaining = deadline - now;
  const stage: ClaimStage = remaining <= 0 ? "overdue" : remaining <= DAY_SECONDS ? "1d" : remaining <= 3 * DAY_SECONDS ? "3d" : remaining <= 7 * DAY_SECONDS ? "7d" : "pending";
  return { deadline, remaining, stage, daysRemaining: Math.ceil(Math.max(0, remaining) / DAY_SECONDS) };
}
export function isClaimOverdue(project: Parameters<typeof claimWindow>[0], now: number) { return claimWindow(project, now)?.stage === "overdue"; }
