/** UI visibility only; all project records remain publicly readable on chain. */
export type ProjectModeration = { approved: boolean; rejected?: boolean; ownerAddress: string };
export function isPublicProject(project: { approved?: boolean; rejected?: boolean; status?: string }) {
  return !project.rejected && project.status !== "rejected" && (project.approved ?? project.status === "approved");
}
export function isPendingProject(project: { approved: boolean; rejected?: boolean }) {
  return !project.approved && !project.rejected;
}
export function canViewProject(project: ProjectModeration, viewer?: string, admin?: string): boolean {
  return isPublicProject(project) || Boolean(viewer && (viewer.toLowerCase() === project.ownerAddress.toLowerCase() || viewer.toLowerCase() === admin?.toLowerCase()));
}
type ModerationRound = { admin?: string; finalized: boolean; isCancelled: boolean; supportsRejection: boolean };
export function canShowRejectProject(project: ProjectModeration, round: ModerationRound, viewer?: string) {
  return Boolean(viewer && round.admin && viewer.toLowerCase() === round.admin.toLowerCase()
    && !round.finalized && !round.isCancelled && isPendingProject(project));
}
export function canRejectProject(project: ProjectModeration, round: ModerationRound, viewer?: string) {
  return round.supportsRejection && canShowRejectProject(project, round, viewer);
}
