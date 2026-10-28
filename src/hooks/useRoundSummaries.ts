"use client";
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { useFactoryRounds } from "@/hooks/useRound";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import { readMirrorRound } from "@/lib/store/chainSync";
import { roundsStore } from "@/lib/store/roundsStore";
import { roundReadRetry } from "@/lib/contracts/roundReads";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { isPublicRound } from "@/lib/roundVisibility";
import { QUERY_STALE_MS, QUERY_GC_MS } from "@/lib/queryPolicy";

export type RoundSummary = {
  address: Address;
  /** 1-based creation order */
  index: number;
  poolUsdc: number;
  projectCount: number;
  active: boolean;
  cancelled: boolean;
  loaded: boolean;
};

/** Light-weight summary of every public round (shares the "round-fields" cache). */
export function useRoundSummaries() {
  const nowSec = useCurrentTimestamp();
  const polling = useVisiblePolling();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { factoryData, isFactoryLoading, isFactoryError } = useFactoryRounds();

  const entries = useMemo(
    () => ((factoryData?.[0]?.result as Address[] | undefined) ?? [])
      .map((address, i) => ({ address, index: i + 1 }))
      .filter((r) => isPublicRound(r.address, TARGET_CHAIN_ID)),
    [factoryData],
  );

  const queries = useQueries({
    queries: entries.map(({ address }) => ({
      queryKey: ["round-fields", TARGET_CHAIN_ID, address.toLowerCase()],
      queryFn: async () => {
        const head = await client!.getBlockNumber({ cacheTime: 0 });
        const floor = roundsStore.getState().entities[address.toLowerCase()]?.confirmedBlock ?? 0n;
        const confirmedBlock = head < floor ? floor : head;
        return { ...(await readMirrorRound(client!, address, confirmedBlock)), confirmedBlock };
      },
      enabled: Boolean(client),
      staleTime: QUERY_STALE_MS,
      gcTime: QUERY_GC_MS,
      refetchInterval: polling,
      refetchIntervalInBackground: false,
      ...roundReadRetry,
    })),
  });

  const summaries: RoundSummary[] = queries.map((q, i) => {
    const r = q.data?.results;
    const cancelled = r?.[15]?.result === true;
    const finalized = r?.[8]?.result === true;
    const endTime = r?.[3]?.result as bigint | undefined;
    const ended = endTime !== undefined && nowSec > 0 && BigInt(nowSec) >= endTime;
    return {
      ...entries[i],
      poolUsdc: Number((r?.[7]?.result as bigint | undefined) ?? 0n) / 1_000_000,
      projectCount: Number((r?.[11]?.result as bigint | undefined) ?? 0n),
      active: !cancelled && !finalized && !ended,
      cancelled,
      loaded: Boolean(r),
    };
  });

  return {
    summaries,
    isLoading: isFactoryLoading || summaries.some((s) => !s.loaded),
    isError: isFactoryError || queries.some((q) => q.isError),
  };
}

/** Featured rounds: not cancelled, open first, then by matching pool (desc). */
export function pickFeaturedRounds(summaries: readonly RoundSummary[], limit = 3): RoundSummary[] {
  return summaries
    .filter((s) => s.loaded && !s.cancelled)
    .sort((a, b) => Number(b.active) - Number(a.active) || b.poolUsdc - a.poolUsdc || b.index - a.index)
    .slice(0, limit);
}
