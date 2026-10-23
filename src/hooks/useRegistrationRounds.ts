"use client";

import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { useFactoryRounds } from "@/hooks/useRound";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { factoryAddress, studentRegistryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { loadRoundFields, roundReadRetry, type RoundCapability } from "@/lib/contracts/roundReads";
import { QUERY_GC_MS, QUERY_STALE_MS } from "@/lib/queryPolicy";
import { isPublicRound } from "@/lib/roundVisibility";
import { registrationRoundState, selectRegistrationRound } from "@/lib/projectRegistration";

const capabilities = new Map<string, RoundCapability>();

export function useRegistrationRounds(initialRound?: string) {
  const { factoryData, isFactoryLoading, isFactoryError, refetchFactory } = useFactoryRounds();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const now = useCurrentTimestamp();
  const [selection, selectRound] = useState(initialRound);
  const addresses = ((factoryData?.[0]?.result as Address[] | undefined) ?? [])
    .map((address, index) => ({ address, number: index + 1 }))
    .filter(round => isPublicRound(round.address, TARGET_CHAIN_ID)).reverse();
  const queries = useQueries({ queries: addresses.map(({ address }) => ({
    queryKey: ["round-fields", TARGET_CHAIN_ID, address.toLowerCase()],
    queryFn: () => loadRoundFields(contracts => client!.multicall({ contracts, allowFailure: true }), address, capabilities),
    enabled: Boolean(client),
    staleTime: QUERY_STALE_MS, gcTime: QUERY_GC_MS, refetchInterval: 15_000,
    ...roundReadRetry,
  })) });
  const rounds = addresses.map((round, index) => {
    const query = queries[index];
    return {
      ...round,
      name: query.data?.results[12]?.result as string | undefined,
      state: query.isError ? "error" as const : registrationRoundState(query.data, now, studentRegistryAddress),
    };
  });
  const factoryError = !isAddress(factoryAddress) || isFactoryError || factoryData?.[0]?.status === "failure";
  const isLoading = !factoryError && (isFactoryLoading || !factoryData || rounds.some(round => round.state === "loading"));
  const isError = Boolean(factoryError || rounds.some(round => round.state === "error"));
  const selected = selectRegistrationRound(rounds, selection);
  const selectedReadError = rounds.some(round => round.address.toLowerCase() === selection?.toLowerCase() && round.state === "error");
  const defaultAddress = selected?.address;
  useEffect(() => {
    if (selection === undefined && !isLoading && defaultAddress) selectRound(defaultAddress);
  }, [selection, isLoading, defaultAddress]);
  return {
    rounds: rounds.filter(round => round.state === "open"),
    roundAddress: selected?.address,
    selectionUnavailable: selection !== undefined && !selected && !isLoading && !selectedReadError,
    selectedReadError,
    selectRound, isLoading, isError,
    refetch: () => { void refetchFactory(); queries.forEach(query => { void query.refetch(); }); },
  };
}
