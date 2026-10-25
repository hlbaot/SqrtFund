"use client";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { useFactoryRounds } from "@/hooks/useRound";
import { TARGET_CHAIN_ID, factoryAddress } from "@/lib/contracts/addresses";
import { loadWalletRoundDonations } from "@/lib/walletDonationHistory";
import type { Address } from "viem";
import { loadDonationHistory, type DonationHistory } from "@/lib/roundRefunds";

export function useWalletDonationHistory() {
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const factory = useFactoryRounds();
  const cache = useQueryClient();
  const enabled = Boolean(address && isConnected && chainId === TARGET_CHAIN_ID && client);
  // Personal history includes old rounds hidden from the public round listing.
  const rounds = [...new Set(((factory.factoryData?.[0]?.result as readonly Address[] | undefined) ?? []).map(round => round.toLowerCase() as Address))];
  const queries = useQueries({ queries: rounds.map(round => ({
    queryKey: ["wallet-donation-history", TARGET_CHAIN_ID, factoryAddress.toLowerCase(), round, address?.toLowerCase()],
    enabled,
    queryFn: ({ signal }: { signal: AbortSignal }) => loadWalletRoundDonations(call => client!.readContract(call), round, address!, async () => {
      const key = ["round-donation-history", TARGET_CHAIN_ID, round] as const;
      const history = await loadDonationHistory(client!, round, cache.getQueryData<DonationHistory>(key), { signal });
      cache.setQueryData(key, history);
      if (history.capped) throw new Error("Donation history scan is incomplete");
      return history.contributions[address!.toLowerCase()] ?? {};
    }),
    staleTime: 15_000,
    refetchInterval: 15_000,
    retry: 2,
  })) });
  return {
    donations: enabled ? queries.flatMap(query => query.data ?? []).reverse() : [],
    isLoading: enabled && (factory.isFactoryLoading || queries.some(query => query.isPending)),
    isError: enabled && (factory.isFactoryError || factory.factoryData?.[0]?.status === "failure" || queries.some(query => query.isError)),
    refetch: () => { void factory.refetchFactory(); queries.forEach(query => { void query.refetch(); }); },
  };
}
