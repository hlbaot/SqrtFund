"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";

export function usePendingRequests(offset = 0n, limit = 50n, active = true) {
  const { isConnected, chainId } = useAccount();
  const { roundAddress } = useRound();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const enabled = Boolean(active && roundAddress && isConnected && chainId === TARGET_CHAIN_ID);
  const { data, isLoading, refetch } = useReadContract({
    address: roundAddress,
    abi: qfRoundAbi,
    functionName: "getRequesters",
    args: [offset, limit],
    query: { enabled, refetchInterval: 15_000, refetchOnWindowFocus: true },
  });
  const requesters = useMemo(() => (data?.[0] as readonly Address[] | undefined) ?? [], [data]);
  const totalCount = Number(data?.[1] ?? 0n);
  const { data: requestedAt = {} } = useQuery({
    queryKey: ["verification-request-times", TARGET_CHAIN_ID, roundAddress, requesters],
    enabled: Boolean(enabled && publicClient && requesters.length),
    staleTime: 15_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const logs = await publicClient!.getLogs({
        address: roundAddress!,
        event: parseAbiItem("event VerificationRequested(address indexed requester)"),
        args: { requester: [...requesters] }, fromBlock: 0n, toBlock: "latest",
      });
      const latest = new Map<string, (typeof logs)[number]>();
      for (const log of logs) {
        if (log.args.requester) latest.set(log.args.requester.toLowerCase(), log);
      }
      const times: Record<string, number> = {};
      const blocks = new Map<bigint, Promise<number>>();
      await Promise.all([...latest].map(async ([account, log]) => {
        let timestamp = blocks.get(log.blockNumber);
        if (!timestamp) {
          timestamp = publicClient!.getBlock({ blockNumber: log.blockNumber }).then(block => Number(block.timestamp) * 1000);
          blocks.set(log.blockNumber, timestamp);
        }
        try { times[account] = await timestamp; } catch { /* Leave the time unknown; never fabricate it. */ }
      }));
      return times;
    },
  });
  return { requesters, totalCount, requestedAt, isLoading, refetch };
}
