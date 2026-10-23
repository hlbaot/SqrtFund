import { parseUnits } from "viem";
import { computeRawMatching } from "@/lib/qf";
import { isPublicProject } from "@/lib/projectVisibility";
import type { Project, Round } from "@/types";
import type { Locale } from "@/lib/copy";

export type RoundPhase = Round["status"] | "upcoming";
export type RoundSummary = Round & { number: number; phase: RoundPhase; version?: "current" | "legacy"; readError?: "version" | "rpc" };
export type LeaderboardProject = Project & { supportedByWallet?: boolean; sumSqrtRaw?: bigint; totalDonatedRaw?: bigint };
export type RankedProject = LeaderboardProject & { supporterRank: number; tied: boolean };
export type LeaderboardSort = "supporters" | "direct" | "matching";

export function displayNumber(value: number, locale: Locale, decimals = 6) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: decimals }).format(value);
}
export function roundDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}
export function matchingValue(project: LeaderboardProject, finalized: boolean) {
  return finalized ? project.finalMatching : project.estimatedMatching;
}
// So sánh BigInt để không mất chênh lệch 0.000001 USDC khi tổng tiền lớn.
const descending = (a: bigint, b: bigint) => a === b ? 0 : a > b ? -1 : 1;
const directAmount = (project: LeaderboardProject) => project.totalDonatedRaw
  ?? parseUnits(project.totalDonated.toFixed(6), 6);

/** Người ủng hộ → QF thô → tiền góp trực tiếp. Bằng cả ba thì đồng hạng. */
export function rankProjects(projects: readonly LeaderboardProject[]): RankedProject[] {
  const eligible = projects.filter(isPublicProject);
  // Reader blockchain luôn có dữ liệu raw. Preview cũ thiếu raw dùng cùng một
  // quy tắc cho cả danh sách (bỏ QF), tránh comparator không nhất quán giữa các cặp.
  const hasQf = eligible.every(project => project.sumSqrtRaw !== undefined && project.totalDonatedRaw !== undefined);
  const metrics = new Map(eligible.map(project => [project, {
    qf: hasQf ? computeRawMatching(project.sumSqrtRaw!, project.totalDonatedRaw!) : 0n,
    direct: directAmount(project),
  }]));
  const compare = (a: LeaderboardProject, b: LeaderboardProject) => b.supporterCount - a.supporterCount
    || descending(metrics.get(a)!.qf, metrics.get(b)!.qf)
    || descending(metrics.get(a)!.direct, metrics.get(b)!.direct);
  // ID chỉ giữ thứ tự ổn định khi đồng hạng, không quyết định thắng thua.
  const sorted = eligible.sort((a, b) => compare(a, b) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  let rank = 0;
  return sorted.map((project, index) => {
    const samePrevious = index > 0 && compare(project, sorted[index - 1]) === 0;
    if (!samePrevious) rank = index + 1;
    const sameNext = index + 1 < sorted.length && compare(project, sorted[index + 1]) === 0;
    return { ...project, supporterRank: rank, tied: samePrevious || sameNext };
  });
}
export function sortProjects(projects: RankedProject[], sort: LeaderboardSort, finalized: boolean) {
  const score = (p: RankedProject) => sort === "direct" ? p.totalDonated : sort === "matching" ? matchingValue(p, finalized) ?? -1 : p.supporterCount;
  return projects.filter(isPublicProject).sort((a, b) => score(b) - score(a) || a.supporterRank - b.supporterRank || a.id.localeCompare(b.id, undefined, { numeric: true }));
}
