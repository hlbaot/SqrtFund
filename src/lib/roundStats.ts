import { isPublicProject } from "@/lib/projectVisibility";
import type { ProjectStatus } from "@/types";

export type ProjectStatItem = {
  status?: ProjectStatus;
  approved?: boolean;
  totalDonated?: number;
  totalDonatedRaw?: bigint;
  supporterCount?: number;
};

export interface RoundStats {
  approvedCount: number;
  totalDonatedRaw: bigint;
  totalDonated: number;
  totalSupporters: number;
}

/**
 * Calculates direct donation total and supporter count across approved projects.
 * Matches the exact calculation logic of the round detail page (/round/[id]).
 */
export function calculateRoundStats(projects: readonly ProjectStatItem[] = []): RoundStats {
  if (!projects || projects.length === 0) {
    return {
      approvedCount: 0,
      totalDonatedRaw: 0n,
      totalDonated: 0,
      totalSupporters: 0,
    };
  }

  const approved = projects.filter(isPublicProject);
  const totalDonatedRaw = approved.reduce((sum, p) => sum + (p.totalDonatedRaw ?? 0n), 0n);
  const totalDonated = approved.reduce((sum, p) => sum + (p.totalDonated ?? 0), 0);
  const totalSupporters = approved.reduce((sum, p) => sum + (p.supporterCount ?? 0), 0);

  return {
    approvedCount: approved.length,
    totalDonatedRaw,
    totalDonated,
    totalSupporters,
  };
}
