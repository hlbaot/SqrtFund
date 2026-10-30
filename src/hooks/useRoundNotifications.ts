"use client";
import { fetchClaimTiming } from "@/hooks/useClaimTiming";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useFactoryRounds } from "@/hooks/useRound";
import { loadRoundNotificationSnapshot } from "@/lib/roundNotifications";
import { TARGET_CHAIN_ID, factoryAddress } from "@/lib/contracts/addresses";
import type { Address } from "viem";

export function useRoundNotifications(wallet?: Address) {
  const queryClient = useQueryClient();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { factoryData } = useFactoryRounds();
  const rounds = ((factoryData?.[0]?.result as readonly Address[] | undefined) ?? []);
  const queries = useQueries({ queries: rounds.map(round => ({
    queryKey: ["round-notifications", TARGET_CHAIN_ID, factoryAddress.toLowerCase(), round.toLowerCase(), wallet?.toLowerCase()],
    enabled: Boolean(wallet && client),
    queryFn: async () => {
      const snapshot = await loadRoundNotificationSnapshot(call => client!.readContract(call), round, wallet);
      if (snapshot.finalized && !snapshot.isCancelled && snapshot.projects.some(p => p.ownerAddress.toLowerCase() === wallet?.toLowerCase() && p.approved && !p.claimed && p.finalMatchingRaw !== undefined && p.totalDonatedRaw + p.finalMatchingRaw > 0n)) {
        try { snapshot.finalizedAt = (await queryClient.fetchQuery({ queryKey: ["round-finalization", round.toLowerCase()], queryFn: () => fetchClaimTiming(round), staleTime: 60 * 60_000 }))?.finalizedAt; }
        catch { /* Preserve ordinary claim/refund notifications when timing cannot be confirmed. */ }
      }
      return snapshot;
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    retry: 2,
  })) });
  return queries.flatMap(query => query.data && !query.isError ? [query.data] : []);
}
