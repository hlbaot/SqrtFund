"use client";
import { useShallow } from "zustand/react/shallow";
import { roundsStore } from "@/lib/store/roundsStore";
import { organizerStore } from "@/lib/store/organizerStore";
import { useVisiblePolling } from "./useVisiblePolling";
import { useMemo, useCallback, useEffect } from "react";
import type { Address } from "viem";
import { useReadContracts, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { readMirrorRound } from "@/lib/store/chainSync";
import { logContractReadFailure, isVersionReadError, roundReadRetry } from "@/lib/contracts/roundReads";
import { factoryAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import type { RoundStatus } from "@/types";
import { QUERY_STALE_MS, QUERY_GC_MS } from "@/lib/queryPolicy";
import { isPublicRound } from "@/lib/roundVisibility";

export function useFactoryRounds(userAddress?: Address) {
  const polling = useVisiblePolling();
  const mirroredAddresses = roundsStore(useShallow(state => state.rounds.map(round => round.address)));
  const { data: chainFactoryData, dataUpdatedAt: factoryUpdatedAt, isLoading: isFactoryLoading, isError: isFactoryError, error: factoryError, refetch: refetchFactory } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "getRounds", chainId: TARGET_CHAIN_ID },
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "owner", chainId: TARGET_CHAIN_ID },
      ...(userAddress ? [{ address: factoryAddress, abi: roundFactoryAbi, functionName: "authorizedOrganizers", args: [userAddress], chainId: TARGET_CHAIN_ID }] : []),
    ],
    query: { enabled: Boolean(factoryAddress), staleTime: QUERY_STALE_MS, gcTime: QUERY_GC_MS, refetchInterval: polling, refetchIntervalInBackground: false, ...roundReadRetry },
  });
  useEffect(() => {
    const addresses = chainFactoryData?.[0]?.result as Address[] | undefined;
    if (addresses) roundsStore.getState().hydrate(addresses.map(address => ({ id: address, address })), factoryUpdatedAt);
    if (userAddress && chainFactoryData?.[2]?.status === "success" && organizerStore.getState().entities[userAddress.toLowerCase()]?.confirmedBlock === undefined) organizerStore.getState().hydrate([{ id: userAddress, authorized: Boolean(chainFactoryData[2].result) }], factoryUpdatedAt);
  }, [chainFactoryData, factoryUpdatedAt, userAddress]);
  const factoryData = useMemo(() => {
    if (!chainFactoryData && !mirroredAddresses.length) return undefined;
    const originals = (chainFactoryData?.[0]?.result as Address[] | undefined) ?? [];
    const addresses = [...originals, ...mirroredAddresses.filter(a => !originals.some(b => a.toLowerCase() === b.toLowerCase()))];
    const values = [...(chainFactoryData ?? [])];
    values[0] = { status: "success", result: addresses } as typeof values[number];
    return values;
  }, [chainFactoryData, mirroredAddresses]);
  useEffect(() => {
    factoryData?.forEach((result, index) => {
      if (result.status === "failure") logContractReadFailure(factoryAddress, index === 0 ? "getRounds" : index === 1 ? "owner" : "authorizedOrganizers", result.error);
    });
    if (isFactoryError) for (const name of ["getRounds", "owner"]) logContractReadFailure(factoryAddress, name, factoryError);
  }, [factoryData, isFactoryError, factoryError]);
  return { factoryData, isFactoryLoading, isFactoryError, refetchFactory };
}
export function useRound(customRoundAddress?: Address, userAddress?: Address) {
  const nowSec = useCurrentTimestamp();
  const polling = useVisiblePolling();
  const { factoryData, isFactoryLoading, isFactoryError, refetchFactory } = useFactoryRounds(userAddress);
  const allRounds = useMemo(() => (factoryData?.[0]?.result as Address[] | undefined) ?? [], [factoryData]);
  const factoryOwner = factoryData?.[1]?.result as Address | undefined;
  const isOrganizer = userAddress && factoryData?.[2]?.status === "success" ? Boolean(factoryData[2].result) : false;
  // Không xem lỗi đọc quyền hoặc Factory cũ là kết quả "chưa được cấp quyền".
  const isLegacyFactory = factoryData?.[2]?.status === "failure" && isVersionReadError(factoryData[2].error);
  const isAuthorizationLoading = Boolean(userAddress && isFactoryLoading);
  const isAuthorizationError = Boolean(userAddress && (isFactoryError || factoryData?.slice(1, 3).some(result => result.status === "failure")));
  // Chỉ bỏ vòng ẩn khi chọn mặc định. URL cụ thể và danh sách quản trị vẫn đọc được vòng cũ.
  const publicRounds = allRounds.filter(address => isPublicRound(address, TARGET_CHAIN_ID));
  const roundAddress = customRoundAddress && customRoundAddress !== "0x0000000000000000000000000000000000000000"
    ? customRoundAddress : publicRounds.at(-1);
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { data: queriedFields, dataUpdatedAt: fieldsUpdatedAt, isLoading: isRoundLoading, isError: isRoundError, error: roundError, refetch: refetchRound } = useQuery({
    queryKey: ["round-fields", TARGET_CHAIN_ID, roundAddress?.toLowerCase()],
    enabled: Boolean(roundAddress && client),
    queryFn: async () => {
      const head = await client!.getBlockNumber({ cacheTime: 0 });
      const floor = roundsStore.getState().entities[roundAddress!.toLowerCase()]?.confirmedBlock ?? 0n;
      const confirmedBlock = head < floor ? floor : head;
      return { ...await readMirrorRound(client!, roundAddress!, confirmedBlock), confirmedBlock };
    },
    refetchInterval: polling, refetchIntervalInBackground: false,
    staleTime: QUERY_STALE_MS,
    gcTime: QUERY_GC_MS,
    ...roundReadRetry,
  });
  const mirroredFields = roundsStore(useShallow(state => roundAddress ? state.entities[roundAddress.toLowerCase()]?.fields : undefined));
  useEffect(() => {
    if (roundAddress && queriedFields && queriedFields.confirmedBlock >= (roundsStore.getState().entities[roundAddress.toLowerCase()]?.confirmedBlock ?? 0n)) roundsStore.getState().hydrate([{ id: roundAddress, address: roundAddress, fields: queriedFields, confirmedBlock: queriedFields.confirmedBlock,
      name: queriedFields.results[12]?.result as string | undefined, admin: queriedFields.results[0]?.result as Address | undefined }], fieldsUpdatedAt);
  }, [roundAddress, queriedFields, fieldsUpdatedAt]);
  const confirmedBlock = roundsStore(useShallow(state => roundAddress ? state.entities[roundAddress.toLowerCase()]?.confirmedBlock : undefined));
  const fields = mirroredFields ?? queriedFields;
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
  const financialStatus: RoundStatus | undefined = typeof roundData?.[8]?.result === "boolean"
    && (roundData?.[15]?.status === "success" || roundData?.[15]?.status === "skipped")
    ? isCancelled ? "cancelled" : finalized ? "finalized"
      : endTime !== undefined && nowSec > 0 ? (BigInt(nowSec) >= endTime ? "closed" : "open") : undefined
    : undefined;
  const refetch = useCallback(() => { void refetchFactory(); if (roundAddress) void refetchRound(); }, [refetchFactory, roundAddress, refetchRound]);
  return {
    roundAddress, allRounds, confirmedBlock, factoryOwner, isOrganizer, isAuthorizationLoading, isAuthorizationError, isLegacyFactory, admin, token, name, organizer, startTime, endTime,
    minDonation, maxDonation, maxMatchBps, maxPerRound: roundData?.[14]?.result as bigint | undefined,
    pool: pool ?? 0n, finalized, leftover: leftover ?? 0n, leftoverWithdrawn,
    projectCount: projectCount ?? 0n, status,
    // Preserve missing reads for financial summaries instead of displaying fallback zeros.
    financials: {
      pool,
      leftover,
      status: financialStatus,
    },
    isCancelled, supportsPhase2: fields?.supportsPhase2 === true, cancelledPoolWithdrawn: roundData?.[16]?.result === true,
    roundVersion: fields?.version, studentRegistry: fields?.registry, readFailureKind,
    isLoading: (!customRoundAddress && isFactoryLoading && !mirroredFields) || (Boolean(roundAddress) && isRoundLoading && !mirroredFields),
    isError: (!customRoundAddress && (isFactoryError || Boolean(factoryData?.some(result => result.status === "failure")))) || isRoundError || coreFailure,
    refetch,
  };
}
