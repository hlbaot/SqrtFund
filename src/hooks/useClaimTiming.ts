"use client";
import { useQuery } from "@tanstack/react-query";
import type { FinalizationTiming } from "@/lib/finalization";
export async function fetchClaimTiming(round: string): Promise<FinalizationTiming | null> {
  const response = await fetch(`/api/round-finalization?round=${round}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw Error("FINALIZATION_UNAVAILABLE");
  if (data.timing === null) throw Error("FINALIZATION_NOT_CONFIRMED");
  if (!data.timing || !Number.isSafeInteger(data.timing.finalizedAt) || data.timing.finalizedAt <= 0 || !/^[0-9]+$/.test(data.timing.blockNumber)) throw Error("FINALIZATION_UNAVAILABLE");
  return data.timing;
}
export function useClaimTiming(round?: string, enabled = true) {
  return useQuery({ queryKey: ["round-finalization", round?.toLowerCase()], enabled: Boolean(round && enabled), queryFn: () => fetchClaimTiming(round!), staleTime: 60 * 60_000, gcTime: 12 * 60 * 60_000, retry: 1, refetchInterval: query => query.state.data ? false : 30_000, refetchOnWindowFocus: true });
}
