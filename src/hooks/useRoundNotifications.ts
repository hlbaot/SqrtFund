"use client";
import { useQueries } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { useFactoryRounds } from "@/hooks/useRound";
import { loadRoundNotificationSnapshot } from "@/lib/roundNotifications";
import { TARGET_CHAIN_ID, factoryAddress } from "@/lib/contracts/addresses";
import { isPublicRound } from "@/lib/roundVisibility";
import type { Address } from "viem";

export function useRoundNotifications(wallet?: Address) {
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { factoryData } = useFactoryRounds();
  const rounds = ((factoryData?.[0]?.result as readonly Address[] | undefined) ?? [])
    .filter(round => isPublicRound(round, TARGET_CHAIN_ID));
  const queries = useQueries({ queries: rounds.map(round => ({
    queryKey: ["round-notifications", TARGET_CHAIN_ID, factoryAddress.toLowerCase(), round.toLowerCase()],
    enabled: Boolean(wallet && client),
    queryFn: () => loadRoundNotificationSnapshot(call => client!.readContract(call), round),
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: 2,
  })) });
  return queries.flatMap(query => query.data ? [query.data] : []);
}
