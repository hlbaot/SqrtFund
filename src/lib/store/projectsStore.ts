import type { EnrichedProject } from "@/hooks/useProjects";
import { createMirrorStore } from "./mirror";
export type StoredProject = EnrichedProject & { storeKey: string; refundedRaw?: bigint };
// Khóa entity gồm vòng: project #1 không duy nhất toàn cục.
export const projectKey = (round: string, id: string | bigint) => `${round.toLowerCase()}:${id}`;
export const projectsStore = createMirrorStore<StoredProject, { projectsByRound: Record<string, StoredProject[]> }>(entities => {
  const projectsByRound: Record<string, StoredProject[]> = {};
  for (const value of Object.values(entities)) {
    const round = value.roundId.toLowerCase();
    (projectsByRound[round] ??= []).push({ ...value, id: value.contractId.toString() });
  }
  for (const list of Object.values(projectsByRound)) list.sort((a, b) => a.contractId < b.contractId ? -1 : 1);
  return { projectsByRound };
});
export const EMPTY_PROJECTS: StoredProject[] = [];
export function storedProject(project: EnrichedProject): StoredProject {
  const storeKey = projectKey(project.roundId, project.contractId);
  return { ...project, id: storeKey, storeKey };
}
