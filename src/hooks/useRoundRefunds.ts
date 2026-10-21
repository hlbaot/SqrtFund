"use client";
import { useMemo } from "react";
import type { Address } from "viem";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { loadDonationHistory, refundRows, refundTotal, type DonationHistory } from "@/lib/roundRefunds";

export interface UseDonationHistoryOptions {
  enabled?: boolean;
  startTime?: bigint;
  endTime?: bigint;
  onProgress?: (progress: {
    scannedBlocks: bigint;
    totalBlocks: bigint;
    completedRequests: number;
    totalRequests: number;
  }) => void;
}

export function useRoundDonationHistory(
  round?: Address,
  enabledOrOptions: boolean | UseDonationHistoryOptions = false
) {
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const queries = useQueryClient();
  const options = typeof enabledOrOptions === "boolean"
    ? { enabled: enabledOrOptions }
    : enabledOrOptions;
  const { enabled = false, startTime, endTime, onProgress } = options;

  const queryKey = ["round-donation-history", TARGET_CHAIN_ID, round?.toLowerCase()] as const;

  return useQuery({
    queryKey,
    enabled: Boolean(enabled && client && round),
    queryFn: ({ signal }) =>
      loadDonationHistory(client!, round!, queries.getQueryData<DonationHistory>(queryKey), {
        startTime,
        endTime,
        signal,
        onProgress,
      }),
    staleTime: 60_000,
    gcTime: 300_000,
    refetchInterval: false,
    retry: 1,
  });
}

export function useRoundRefunds(
  round: Address | undefined,
  projectCount: bigint,
  viewer: Address | undefined,
  enabled: boolean,
  history?: DonationHistory
) {
  // Current QFRound MAX_PROJECTS is 50. Validate its getter before allowing any refund batch.
  const ids = useMemo(() => Array.from({ length: Math.min(Number(projectCount), 50) }, (_, index) => BigInt(index + 1)), [projectCount]);
  const limit = useReadContract({
    address: round,
    abi: qfRoundAbi,
    functionName: "MAX_PROJECTS",
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(enabled && round), staleTime: Infinity },
  });
  const maxProjects = limit.data;
  const validLimit = typeof maxProjects === "bigint" && maxProjects > 0n && projectCount <= maxProjects && projectCount <= 50n;
  const reads = useReadContracts({
    allowFailure: true,
    contracts: ids.map(id => ({
      address: round!,
      abi: qfRoundAbi,
      functionName: "donationOf" as const,
      args: [viewer!, id] as const,
      chainId: TARGET_CHAIN_ID,
    })),
    query: { enabled: Boolean(enabled && round && viewer && ids.length && validLimit), staleTime: 5000, refetchInterval: 5000 },
  });
  const values = reads.data ?? [];
  const isError = limit.isError || reads.isError || (limit.isSuccess && !validLimit) || Boolean(reads.data?.some(value => value.status === "failure"));
  const isReady = Boolean(enabled && validLimit && !isError && values.length === ids.length && values.every(value => value.status === "success" && typeof value.result === "bigint"));
  const rows = isReady ? refundRows(ids, values, viewer ? history?.contributions[viewer.toLowerCase()] : undefined) : [];
  return {
    rows,
    total: refundTotal(rows),
    maxProjects,
    isReady,
    isError,
    refetch: async () => {
      await limit.refetch();
      return reads.refetch();
    },
  };
}
