"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";

export function usePendingRequests(offset = 0n, limit = 50n) {
  const { isConnected, chainId } = useAccount();
  const { roundAddress } = useRound();
  const publicClient = usePublicClient();

  const isTargetChain = chainId === TARGET_CHAIN_ID;
  const enabled = Boolean(roundAddress && isConnected && isTargetChain);

  const [requestedAt, setRequestedAt] = useState<Record<string, number>>({});

  const { data, isLoading, refetch } = useReadContract({
    address: roundAddress,
    abi: qfRoundAbi,
    functionName: "getRequesters",
    args: [offset, limit],
    query: {
      enabled,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const requesters = useMemo(
    () => (data?.[0] as readonly Address[] | undefined) ?? [],
    [data]
  );
  const totalCount = Number(data?.[1] ?? 0n);

  // Fetch block timestamps for requesters from VerificationRequested events
  useEffect(() => {
    let cancelled = false;
    if (!publicClient || !roundAddress || requesters.length === 0) return;

    const run = async () => {
      try {
        const logs = await publicClient.getLogs({
          address: roundAddress,
          event: parseAbiItem("event VerificationRequested(address indexed requester)"),
          fromBlock: 0n,
        });

        if (cancelled) return;

        const blockTimestamps = new Map<bigint, number>();
        const timestampsMap: Record<string, number> = {};

        for (const log of logs) {
          const reqAddr = log.args.requester?.toLowerCase();
          if (!reqAddr) continue;

          let time = blockTimestamps.get(log.blockNumber);
          if (!time) {
            try {
              const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
              time = Number(block.timestamp) * 1000;
              blockTimestamps.set(log.blockNumber, time);
            } catch {
              time = Date.now();
            }
          }
          timestampsMap[reqAddr] = time;
        }

        if (!cancelled) {
          setRequestedAt((prev) => ({ ...prev, ...timestampsMap }));
        }
      } catch {
        // Best-effort timestamp fetching
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [publicClient, roundAddress, requesters]);

  return {
    requesters,
    totalCount,
    requestedAt,
    isLoading,
    refetch,
  };
}
