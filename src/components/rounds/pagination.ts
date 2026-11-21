import type { RoundSummary } from "@/components/leaderboard/model";

export const ROUNDS_PAGE_SIZE = 6;
export const ROUNDS_GRID = "grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3";
export type RoundFilter = "all" | "active" | "ended";
export type RoundSort = "newest" | "pool" | "supporters";

export function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function paginateRounds(rounds: RoundSummary[], filter: RoundFilter, requestedPage: number, sort: RoundSort = "newest") {
  const filtered = rounds.filter(round =>
    filter === "all" || (!round.readError && (filter === "active" ? round.phase === "open" : ["closed", "finalized", "cancelled"].includes(round.phase))));
  filtered.sort((a, b) => {
    const newestFirst = b.number - a.number;
    if (sort === "newest") return newestFirst;
    if (a.readError || b.readError) return Number(Boolean(a.readError)) - Number(Boolean(b.readError)) || newestFirst;
    const metric = sort === "pool" ? "matchingPool" : "totalSupporters";
    return b[metric] - a[metric] || newestFirst;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROUNDS_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  return { page, totalPages, total: filtered.length, rounds: filtered.slice((page - 1) * ROUNDS_PAGE_SIZE, page * ROUNDS_PAGE_SIZE) };
}
