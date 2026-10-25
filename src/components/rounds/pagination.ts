import type { RoundSummary } from "@/components/leaderboard/model";

export const ROUNDS_PAGE_SIZE = 6;
export const ROUNDS_GRID = "grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 lg:grid-cols-3";
export type RoundFilter = "all" | "active" | "ended";

export function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function paginateRounds(rounds: RoundSummary[], filter: RoundFilter, requestedPage: number) {
  const filtered = [...rounds].sort((a, b) => b.number - a.number).filter(round =>
    filter === "all" || (!round.readError && (filter === "active" ? round.phase === "open" : ["closed", "finalized", "cancelled"].includes(round.phase))));
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROUNDS_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, totalPages));
  return { page, totalPages, total: filtered.length, rounds: filtered.slice((page - 1) * ROUNDS_PAGE_SIZE, page * ROUNDS_PAGE_SIZE) };
}
