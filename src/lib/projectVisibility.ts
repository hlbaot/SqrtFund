/** UI visibility only; project records remain publicly readable on chain. */
export function canViewProject(project: { approved: boolean; ownerAddress: string }, viewer?: string, admin?: string): boolean {
  return project.approved || Boolean(viewer && (viewer.toLowerCase() === project.ownerAddress.toLowerCase() || viewer.toLowerCase() === admin?.toLowerCase()));
}
