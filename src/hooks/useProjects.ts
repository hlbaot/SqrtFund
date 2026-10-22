"use client";

import { useMemo, useEffect } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { logContractReadFailure, isVersionReadError, roundReadRetry } from "@/lib/contracts/roundReads";
import { legacyProjectAbi } from "@/lib/contracts/legacyProjectAbi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { canViewProject } from "@/lib/projectVisibility";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import type { Project, ProjectCategory } from "@/types";
import { QUERY_STALE_MS, QUERY_GC_MS } from "@/lib/queryPolicy";

export type ProjectContractItem = {
  id: bigint;
  owner: Address;
  name: string;
  description: string;
  imageUrl: string;
  link: string;
  approved: boolean;
  claimed: boolean;
  sumSqrt: bigint;
  totalDonated: bigint;
  donorCount: bigint;
  rejected?: boolean;
};

export type EnrichedProject = Project & {
  contractId: bigint;
  sumSqrtRaw: bigint;
  totalDonatedRaw: bigint;
  estimatedMatchingRaw: bigint;
  finalMatchingRaw?: bigint;
  claimed: boolean;
  approved: boolean;
  rejected: boolean;
};

export function useProjects(customRoundAddress?: Address, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled !== false;
  const { roundAddress: defaultRoundAddress, admin, finalized } = useRound(customRoundAddress);
  const { address, isConnected, chainId } = useAccount();
  const viewer = isConnected && chainId === TARGET_CHAIN_ID ? address : undefined;
  const roundAddress = customRoundAddress || defaultRoundAddress;
  // Old rounds have shorter dynamic project tuples. Probe the getter before decoding.
  const rejectionProbe = useReadContract({
    address: roundAddress, abi: qfRoundAbi, functionName: "rejected", args: [0n], chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(enabled && roundAddress), staleTime: Infinity, gcTime: QUERY_GC_MS, retryOnMount: false, retry: (attempt, error) => !isVersionReadError(error) && attempt < 2 },
  });
  const supportsRejection = typeof rejectionProbe.data === "boolean";
  const probeResolved = supportsRejection || (rejectionProbe.isError && isVersionReadError(rejectionProbe.error));

  const {
    data: contractData,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        address: roundAddress,
        abi: supportsRejection ? qfRoundAbi : legacyProjectAbi,
        chainId: TARGET_CHAIN_ID,
        functionName: "getProjects",
        args: [0n, 50n],
      },
      {
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "previewMatching",
        chainId: TARGET_CHAIN_ID,
      },
    ],
    query: {
      enabled: enabled && Boolean(roundAddress) && probeResolved,
      refetchInterval: 15000,
      staleTime: QUERY_STALE_MS,
      gcTime: QUERY_GC_MS,
      ...roundReadRetry,
    },
  });

  useEffect(() => {
    if (!roundAddress) return;
    contractData?.forEach((result, index) => {
      if (result.status === "failure") logContractReadFailure(roundAddress, index === 0 ? "getProjects" : "previewMatching", result.error);
    });
    if (isError) for (const name of ["getProjects", "previewMatching"]) logContractReadFailure(roundAddress, name, error);
  }, [contractData, roundAddress, isError, error]);

  const projectsData = contractData?.[0]?.result as
    | [readonly ProjectContractItem[], bigint]
    | undefined;

  const previewData = contractData?.[1]?.result as
    | [readonly bigint[], readonly bigint[]]
    | undefined;

  // Read the recorded settlement, rather than presenting a preview as a finalized payout.
  const payoutProjects = useMemo(() => projectsData?.[0]?.filter(project => project.approved) ?? [], [projectsData]);
  const finalPayouts = useReadContracts({
    allowFailure: true,
    contracts: payoutProjects.map(project => ({
      address: roundAddress, abi: qfRoundAbi, functionName: "payoutOf" as const,
      args: [project.id] as const, chainId: TARGET_CHAIN_ID,
    })),
    query: {
      enabled: enabled && Boolean(roundAddress) && finalized === true && payoutProjects.length > 0,
      staleTime: QUERY_STALE_MS, gcTime: QUERY_GC_MS, refetchInterval: 15000, ...roundReadRetry,
    },
  });
  const finalMap = useMemo(() => {
    const map = new Map<string, bigint>();
    if (finalized) payoutProjects.forEach((project, index) => {
      const result = finalPayouts.data?.[index];
      if (result?.status === "success" && typeof result.result === "bigint") map.set(project.id.toString(), result.result);
    });
    return map;
  }, [finalized, payoutProjects, finalPayouts.data]);

  const estimatedMap = useMemo(() => {
    const map = new Map<string, bigint>();
    if (previewData && previewData[0] && previewData[1]) {
      const ids = previewData[0];
      const payouts = previewData[1];
      for (let i = 0; i < ids.length; i++) {
        map.set(ids[i].toString(), payouts[i]);
      }
    }
    return map;
  }, [previewData]);

  const projects: EnrichedProject[] = useMemo(() => {
    if (!projectsData || !projectsData[0]) return [];

    const rawList = projectsData[0];
    return rawList.map((p, index): EnrichedProject => {
      const pIdStr = p.id.toString();
      const matchingBigInt = estimatedMap.get(pIdStr) ?? 0n;
      const totalDonatedNum = Number(p.totalDonated) / 1_000_000;
      const matchingNum = Number(matchingBigInt) / 1_000_000;
      const finalMatchingRaw = finalMap.get(pIdStr);

      return {
        id: pIdStr,
        roundId: roundAddress ?? "",
        name: p.name,
        shortDescription: p.description.slice(0, 100),
        description: p.description,
        category: "technology" as ProjectCategory,
        imageUrl: p.imageUrl || "/images/placeholder.svg",
        contactUrl: p.link,
        ownerAddress: p.owner,
        supporterCount: Number(p.donorCount),
        totalDonated: totalDonatedNum,
        estimatedMatching: matchingNum,
        finalMatching: finalMatchingRaw === undefined ? undefined : Number(finalMatchingRaw) / 1_000_000,
        finalMatchingRaw,
        status: p.rejected ? "rejected" : p.approved ? "approved" : "pending",
        rejected: p.rejected === true,
        rank: index + 1,
        // Raw values for precision
        contractId: p.id,
        sumSqrtRaw: p.sumSqrt,
        totalDonatedRaw: p.totalDonated,
        estimatedMatchingRaw: matchingBigInt,
        claimed: p.claimed,
        approved: p.approved,
      };
    });
  }, [projectsData, estimatedMap, roundAddress, finalMap]);

  const visibleProjects = useMemo(() => projects.filter(project => canViewProject(project, viewer, admin)), [projects, viewer, admin]);

  return {
    projects: visibleProjects,
    supportsRejection,
    readFailureKind: contractData?.some(result => result.status === "failure" && isVersionReadError(result.error)) ? "version" as const : "rpc" as const,
    isLoading: enabled && Boolean(roundAddress) && ((!probeResolved && !rejectionProbe.isError) || (probeResolved && isLoading)),
    isError: (!probeResolved && rejectionProbe.isError) || isError || contractData?.[0]?.status === "failure",
    // A failed capability probe must be retried before choosing a tuple ABI.
    refetch: () => {
      if (finalized && payoutProjects.length) void finalPayouts.refetch();
      return probeResolved ? refetch() : rejectionProbe.refetch();
    },
  };
}
