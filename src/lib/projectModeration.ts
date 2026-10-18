import { isPendingProject, type ProjectModeration } from "@/lib/projectVisibility";

export type ModerationAction = "approve" | "reject";
export type ModerationRound = { admin?: string; endTime?: bigint; finalized: boolean; isCancelled: boolean; supportsRejection: boolean };
export type ModerationReason = "expired" | "finalized" | "cancelled" | "loading" | "unauthorized" | "notPending" | "legacy";

/** Frontend permissions only; contract access and time checks remain authoritative. */
export function projectModerationState(project: ProjectModeration, round: ModerationRound, viewer: string | undefined, now: number) {
  const blocked = (reason: ModerationReason) => ({ showActions: false, canApprove: false, canReject: false, reason });
  if (!viewer || viewer.toLowerCase() !== round.admin?.toLowerCase()) return blocked("unauthorized");
  if (!isPendingProject(project)) return blocked("notPending");
  if (round.endTime !== undefined && now > 0 && BigInt(now) >= round.endTime) return blocked("expired");
  if (round.finalized) return blocked("finalized");
  if (round.isCancelled) return blocked("cancelled");
  if (round.endTime === undefined || now <= 0) return blocked("loading");
  return { showActions: true, canApprove: true, canReject: round.supportsRejection, reason: round.supportsRejection ? undefined : "legacy" as ModerationReason };
}

export function safeProjectLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined; }
  catch { return undefined; }
}
