"use client";
import { useMemo, useCallback, useEffect } from "react";
import type { Address } from "viem";
import { useReadContracts, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { loadRoundFields, logContractReadFailure, isVersionReadError, roundReadRetry, type RoundCapability } from "@/lib/contracts/roundReads";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import type { RoundStatus } from "@/types";
import { QUERY_STALE_MS, QUERY_GC_MS } from "@/lib/queryPolicy";

const capabilities = new Map<string, RoundCapability>(); // Fuji only; immutable QFRound deployments.
export function useFactoryRounds() {
  const { data: factoryData, isLoading: isFactoryLoading, isError: isFactoryError, error: factoryError, refetch: refetchFactory } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "getRounds", chainId: TARGET_CHAIN_ID },
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "owner", chainId: TARGET_CHAIN_ID },
    ],
    query: { enabled: Boolean(factoryAddress), staleTime: QUERY_STALE_MS, gcTime: QUERY_GC_MS, refetchInterval: 15000, ...roundReadRetry },
  });
  useEffect(() => {
    factoryData?.forEach((result, index) => {
      if (result.status === "failure") logContractReadFailure(factoryAddress, index === 0 ? "getRounds" : "owner", result.error);
    });
    if (isFactoryError) for (const name of ["getRounds", "owner"]) logContractReadFailure(factoryAddress, name, factoryError);
  }, [factoryData, isFactoryError, factoryError]);
  return { factoryData, isFactoryLoading, isFactoryError, refetchFactory };
}
export function useRound(customRoundAddress?: Address) {
  const nowSec = useCurrentTimestamp();
  const { factoryData, isFactoryLoading, isFactoryError, refetchFactory } = useFactoryRounds();
  const allRounds = useMemo(() => (factoryData?.[0]?.result as Address[] | undefined) ?? [], [factoryData]);
  const factoryOwner = factoryData?.[1]?.result as Address | undefined;
  const roundAddress = customRoundAddress && customRoundAddress !== "0x0000000000000000000000000000000000000000"
    ? customRoundAddress : allRounds.at(-1);
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { data: fields, isLoading: isRoundLoading, isError: isRoundError, error: roundError, refetch: refetchRound } = useQuery({
    queryKey: ["round-fields", TARGET_CHAIN_ID, roundAddress?.toLowerCase()],
    enabled: Boolean(roundAddress && client),
    queryFn: () => loadRoundFields(contracts => client!.multicall({ contracts, allowFailure: true }), roundAddress!, capabilities),
    refetchInterval: 15000,
    staleTime: QUERY_STALE_MS,
    gcTime: QUERY_GC_MS,
    ...roundReadRetry,
  });
  const roundData = fields?.results;
  const coreFailure = roundData?.slice(0, 12).some(result => result.status === "failure") ?? false;
  const readFailureKind = isVersionReadError(roundError) || roundData?.some(result => result.status === "failure" && isVersionReadError(result.error)) ? "version" as const : "rpc" as const;
  const admin = roundData?.[0]?.result as Address | undefined;
  const token = roundData?.[1]?.result as Address | undefined;
  const startTime = roundData?.[2]?.result as bigint | undefined;
  const endTime = roundData?.[3]?.result as bigint | undefined;
  const minDonation = roundData?.[4]?.result as bigint | undefined;
  const maxDonation = roundData?.[5]?.result as bigint | undefined;
  const maxMatchBps = roundData?.[6]?.result as bigint | undefined;
  const pool = roundData?.[7]?.result as bigint | undefined;
  const isCancelled = roundData?.[15]?.result === true;
  const finalized = Boolean(roundData?.[8]?.result);
  const leftover = roundData?.[9]?.result as bigint | undefined;
  const leftoverWithdrawn = Boolean(roundData?.[10]?.result);
  const projectCount = roundData?.[11]?.result as bigint | undefined;
  const rawName = roundData?.[12]?.status === "success" ? roundData[12].result as string : undefined;
  const rawOrganizer = roundData?.[13]?.status === "success" ? roundData[13].result as string : undefined;
  const name = rawName?.trim() || undefined;
  const organizer = rawOrganizer?.trim() || undefined;
  const status: RoundStatus = useMemo(() => {
    if (isCancelled) return "cancelled";
    if (finalized) return "finalized";
    if (startTime && endTime && nowSec > 0 && BigInt(nowSec) >= endTime) return "closed";
    return "open";
  }, [isCancelled, finalized, startTime, endTime, nowSec]);
  const refetch = useCallback(() => { void refetchFactory(); if (roundAddress) void refetchRound(); }, [refetchFactory, roundAddress, refetchRound]);
  return {
    roundAddress, allRounds, factoryOwner, admin, token, name, organizer, startTime, endTime,
    minDonation, maxDonation, maxMatchBps, maxPerRound: roundData?.[14]?.result as bigint | undefined,
    pool: pool ?? 0n, finalized, leftover: leftover ?? 0n, leftoverWithdrawn,
    projectCount: projectCount ?? 0n, status,
    isCancelled, supportsPhase2: fields?.supportsPhase2 === true, cancelledPoolWithdrawn: roundData?.[16]?.result === true,
    roundVersion: fields?.version, studentRegistry: fields?.registry, readFailureKind,
    isLoading: (!customRoundAddress && isFactoryLoading) || (Boolean(roundAddress) && isRoundLoading),
    isError: (!customRoundAddress && (isFactoryError || Boolean(factoryData?.some(result => result.status === "failure")))) || isRoundError || coreFailure,
    refetch,
  };
}
