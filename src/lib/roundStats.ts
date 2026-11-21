import { isPublicProject } from "@/lib/projectVisibility";
import type { ProjectStatus } from "@/types";
import { computeRoundAllocation, computeRawMatching, matchingCoverage } from "@/lib/qf";

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

/** Tính tổng quyên góp trực tiếp và số người ủng hộ ở các dự án đã duyệt, khớp logic trang chi tiết vòng (/round/[id]). */
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

type FundingProject = ProjectStatItem & { sumSqrtRaw?: bigint; rejected?: boolean };

/** Nhu cầu thô chỉ là ước tính kể cả sau finalize, không phải payout đã bị trần. */
export function calculateRoundFundingStats(
  projects: readonly FundingProject[] | undefined,
  pool: bigint | undefined,
  finalized = false,
  cancelled = false,
) {
  const approved = projects?.filter(isPublicProject);
  const stats = projects ? calculateRoundStats(projects) : undefined;
  const donationsReadable = approved?.every(p => typeof p.totalDonatedRaw === "bigint" && p.totalDonatedRaw >= 0n);
  const matchingReadable = donationsReadable && approved?.every(p => typeof p.sumSqrtRaw === "bigint" && p.sumSqrtRaw >= 0n);
  const totalRaw = matchingReadable
    ? approved!.reduce((sum, p) => sum + computeRawMatching(p.sumSqrtRaw!, p.totalDonatedRaw!), 0n)
    : undefined;
  const coverage = totalRaw !== undefined && pool !== undefined && pool >= 0n
    ? matchingCoverage(totalRaw, pool) : undefined;
  const needed = coverage ? (coverage.underfunded ? totalRaw! - pool! : 0n) : undefined;
  return {
    approvedCount: stats?.approvedCount,
    pendingCount: projects?.filter(p => !p.rejected && (p.status === "pending" || (p.status === undefined && p.approved === false))).length,
    totalDonatedRaw: donationsReadable ? stats?.totalDonatedRaw : undefined,
    totalRaw,
    coverage,
    needed,
    // Chia làm tròn lên theo micro-USDC để tránh sai số float và ký hiệu khoa học
    suggestedDeposit: needed !== undefined && needed > 0n && !finalized && !cancelled
      ? ((needed + 999_999n) / 1_000_000n).toString() : undefined,
  };
}

/** Phân bổ chính xác của contract (gồm trần từng dự án và làm tròn số nguyên). */
export function calculateRoundSettlement(projects: readonly (FundingProject & { claimed?: boolean })[] | undefined, pool?: bigint, maxMatchBps?: bigint, finalizedLeftover?: bigint) {
  const funding = calculateRoundFundingStats(projects, pool);
  const approved = projects?.filter(isPublicProject);
  const allocation = approved && funding.totalRaw !== undefined && pool !== undefined && pool >= 0n
    && maxMatchBps !== undefined && maxMatchBps >= 0n && maxMatchBps <= 10000n
    ? computeRoundAllocation(approved.map((p, id) => ({ id, sumSqrt: p.sumSqrtRaw!, totalDonated: p.totalDonatedRaw! })), pool, maxMatchBps) : undefined;
  const results = allocation?.allocations;
  const estimated = allocation?.matching;
  const knownFinal = pool !== undefined && finalizedLeftover !== undefined && finalizedLeftover >= 0n && finalizedLeftover <= pool;
  return {
    ...funding,
    matching: knownFinal ? pool - finalizedLeftover : estimated,
    leftover: knownFinal ? finalizedLeftover : allocation?.leftover,
    matchingCount: results?.filter(result => result.payout > 0n).length,
    allClaimed: approved !== undefined && results !== undefined && approved.every((project, index) =>
      project.totalDonatedRaw! + results[index].payout === 0n || project.claimed === true),
  };
}
