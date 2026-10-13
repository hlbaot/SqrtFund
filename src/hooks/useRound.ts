"use client";

import { useMemo, useEffect } from "react";
import type { Address } from "viem";
import { useReadContracts, useBlockNumber } from "wagmi";
import { factoryAddress } from "@/lib/contracts/addresses";
import { roundFactoryAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import type { RoundStatus } from "@/types";

export function useRound(customRoundAddress?: Address) {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const nowSec = useCurrentTimestamp();

  // 1. Read all rounds and factory owner from RoundFactory
  const {
    data: factoryData,
    isLoading: isFactoryLoading,
    refetch: refetchFactory,
  } = useReadContracts({
    contracts: [
      {
        address: factoryAddress,
        abi: roundFactoryAbi,
        functionName: "getRounds",
      },
      {
        address: factoryAddress,
        abi: roundFactoryAbi,
        functionName: "owner",
      },
    ],
    query: {
      enabled: Boolean(factoryAddress),
      refetchInterval: 5000,
    },
  });

  const allRounds = useMemo(() => {
    return (factoryData?.[0]?.result as Address[] | undefined) ?? [];
  }, [factoryData]);

  const factoryOwner = useMemo(() => {
    return factoryData?.[1]?.result as Address | undefined;
  }, [factoryData]);

  // If customRoundAddress is provided and valid, use it; otherwise use the latest round
  const roundAddress: Address | undefined = useMemo(() => {
    if (customRoundAddress && customRoundAddress !== "0x0000000000000000000000000000000000000000") {
      return customRoundAddress;
    }
    if (allRounds.length > 0) {
      return allRounds[allRounds.length - 1];
    }
    return undefined;
  }, [customRoundAddress, allRounds]);

  // 2. Read round details multicall
  const {
    data: roundData,
    isLoading: isRoundLoading,
    isError: isRoundError,
    refetch: refetchRound,
  } = useReadContracts({
    contracts: [
      { address: roundAddress, abi: qfRoundAbi, functionName: "admin" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "token" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "startTime" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "endTime" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "minDonation" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "maxDonation" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "maxMatchBps" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "pool" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "finalized" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "leftover" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "leftoverWithdrawn" },
      { address: roundAddress, abi: qfRoundAbi, functionName: "projectCount" },
    ],
    query: {
      enabled: Boolean(roundAddress),
      refetchInterval: 5000,
    },
  });

  // Watch block numbers and refetch
  useEffect(() => {
    if (blockNumber) {
      refetchRound();
      refetchFactory();
    }
  }, [blockNumber, refetchRound, refetchFactory]);

  const admin = roundData?.[0]?.result as Address | undefined;
  const token = roundData?.[1]?.result as Address | undefined;
  const startTime = roundData?.[2]?.result as bigint | undefined;
  const endTime = roundData?.[3]?.result as bigint | undefined;
  const minDonation = roundData?.[4]?.result as bigint | undefined;
  const maxDonation = roundData?.[5]?.result as bigint | undefined;
  const maxMatchBps = roundData?.[6]?.result as bigint | undefined;
  const pool = roundData?.[7]?.result as bigint | undefined;
  const finalized = Boolean(roundData?.[8]?.result);
  const leftover = roundData?.[9]?.result as bigint | undefined;
  const leftoverWithdrawn = Boolean(roundData?.[10]?.result);
  const projectCount = roundData?.[11]?.result as bigint | undefined;

  const status: RoundStatus = useMemo(() => {
    if (finalized) return "finalized";
    if (!startTime || !endTime) return "open";
    if (nowSec > 0 && BigInt(nowSec) >= endTime) return "closed";
    return "open";
  }, [finalized, startTime, endTime, nowSec]);

  const refetch = () => {
    refetchFactory();
    if (roundAddress) refetchRound();
  };

  return {
    roundAddress,
    allRounds,
    factoryOwner,
    admin,
    token,
    startTime,
    endTime,
    minDonation,
    maxDonation,
    maxMatchBps,
    pool: pool ?? 0n,
    finalized,
    leftover: leftover ?? 0n,
    leftoverWithdrawn,
    projectCount: projectCount ?? 0n,
    status,
    isLoading: isFactoryLoading || (Boolean(roundAddress) && isRoundLoading),
    isError: isRoundError,
    refetch,
  };
}
