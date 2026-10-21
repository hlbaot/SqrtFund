"use client";
import { useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { useFactoryRounds } from "@/hooks/useRound";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { IMMUTABLE_STALE_MS, QUERY_GC_MS } from "@/lib/queryPolicy";

/** Factory order is creation order; only this wallet's rounds are deposit targets. */
export function useAdminRounds(admin?: Address) {
  const { factoryData, isFactoryLoading, isFactoryError, refetchFactory } = useFactoryRounds();
  const [selection, selectRound] = useState<string | undefined>();
  const addresses = useMemo(() => (factoryData?.[0]?.result as Address[] | undefined) ?? [], [factoryData]);
  const metadata = useReadContracts({
    allowFailure: true,
    contracts: addresses.flatMap(address => [
      { address, abi: qfRoundAbi, functionName: "admin" as const, chainId: TARGET_CHAIN_ID },
      { address, abi: qfRoundAbi, functionName: "name" as const, chainId: TARGET_CHAIN_ID },
    ]),
    query: { enabled: Boolean(admin && addresses.length), staleTime: IMMUTABLE_STALE_MS, gcTime: QUERY_GC_MS },
  });
  const isError = !isAddress(factoryAddress) || isFactoryError || factoryData?.[0]?.status === "failure" || metadata.isError || Boolean(addresses.length && metadata.data?.some((result, i) => i % 2 === 0 && result.status === "failure"));
  const isLoading = Boolean(admin) && !isError && (isFactoryLoading || !factoryData || Boolean(addresses.length && (!metadata.data || metadata.isPending)));
  const rounds = addresses.map((address, i) => ({
    address,
    admin: metadata.data?.[i * 2]?.result as Address | undefined,
    name: metadata.data?.[i * 2 + 1]?.result as string | undefined,
  })).filter(round => admin && round.admin?.toLowerCase() === admin.toLowerCase()).reverse();
  // New rounds become the default until the user explicitly chooses an existing target.
  const roundAddress = rounds.find(round => round.address.toLowerCase() === selection?.toLowerCase())?.address ?? rounds[0]?.address;
  return { rounds, totalRounds: addresses.length, roundAddress, selectRound, isLoading, isError, refetch: () => { void refetchFactory(); void metadata.refetch(); } };
}
