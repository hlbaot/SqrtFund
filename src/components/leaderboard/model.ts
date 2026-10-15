import type { Project, Round } from "@/types";
import type { Locale } from "@/lib/copy";

export type RoundPhase = Round["status"] | "upcoming";
export type RoundSummary = Round & { number: number; phase: RoundPhase };
export type LeaderboardProject = Project & { finalMatching?: number; supportedByWallet?: boolean };
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
// Competition ranks remain based on supporters, regardless of the display sort.
export function rankProjects(projects: readonly LeaderboardProject[]): RankedProject[] {
  const sorted = [...projects].sort((a, b) => b.supporterCount - a.supporterCount || a.id.localeCompare(b.id, undefined, { numeric: true }));
  let rank = 0;
  const counts = new Map<number, number>();
  for (const project of sorted) counts.set(project.supporterCount, (counts.get(project.supporterCount) ?? 0) + 1);
  return sorted.map((project, index) => {
    if (index === 0 || project.supporterCount !== sorted[index - 1].supporterCount) rank = index + 1;
    return { ...project, supporterRank: rank, tied: (counts.get(project.supporterCount) ?? 0) > 1 };
  });
}
export function sortProjects(projects: RankedProject[], sort: LeaderboardSort, finalized: boolean) {
  const score = (p: RankedProject) => sort === "direct" ? p.totalDonated : sort === "matching" ? matchingValue(p, finalized) ?? -1 : p.supporterCount;
  return [...projects].sort((a, b) => score(b) - score(a) || a.supporterRank - b.supporterRank || a.id.localeCompare(b.id, undefined, { numeric: true }));
}
