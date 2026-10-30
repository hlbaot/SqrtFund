"use client";
import { useRoundGovernance } from "@/hooks/useRoundGovernance";
import { useShallow } from "zustand/react/shallow";
import { roundsStore } from "@/lib/store/roundsStore";
import { projectsStore, storedProject } from "@/lib/store/projectsStore";
import { useVisiblePolling } from "./useVisiblePolling";

import { useMemo, useEffect } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { logContractReadFailure, isVersionReadError, roundReadRetry } from "@/lib/contracts/roundReads";
import { legacyProjectAbi } from "@/lib/contracts/legacyProjectAbi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { rankProjects } from "@/components/leaderboard/model";
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
  const polling = useVisiblePolling();
  const { roundAddress: defaultRoundAddress, admin, finalized, finalizedAt, isCancelled, confirmedBlock } = useRound(customRoundAddress);
  const { address, isConnected, chainId } = useAccount();
  const viewer = isConnected && chainId === TARGET_CHAIN_ID ? address : undefined;
  const roundAddress = customRoundAddress || defaultRoundAddress;
  const governance = useRoundGovernance(enabled ? roundAddress : undefined);
  // Old rounds have shorter dynamic project tuples. Probe the getter before decoding.
  const rejectionProbe = useReadContract({
    address: roundAddress, abi: qfRoundAbi, functionName: "rejected", args: [0n], chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(enabled && roundAddress), staleTime: Infinity, gcTime: QUERY_GC_MS, retryOnMount: false, retry: (attempt, error) => !isVersionReadError(error) && attempt < 2 },
  });
  const supportsRejection = typeof rejectionProbe.data === "boolean";
  const probeResolved = supportsRejection || (rejectionProbe.isError && isVersionReadError(rejectionProbe.error));

  const {
    data: contractData,
    dataUpdatedAt: projectsUpdatedAt,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContracts({
    blockNumber: confirmedBlock,
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
      refetchInterval: polling, refetchIntervalInBackground: false,
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
    blockNumber: confirmedBlock,
    allowFailure: true,
    contracts: payoutProjects.map(project => ({
      address: roundAddress, abi: qfRoundAbi, functionName: "payoutOf" as const,
      args: [project.id] as const, chainId: TARGET_CHAIN_ID,
    })),
    query: {
      enabled: enabled && Boolean(roundAddress) && finalized === true && payoutProjects.length > 0,
      staleTime: QUERY_STALE_MS, gcTime: QUERY_GC_MS, refetchInterval: polling, refetchIntervalInBackground: false, ...roundReadRetry,
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

  const queriedProjects: EnrichedProject[] = useMemo(() => {
    if (!projectsData || !projectsData[0]) return [];

    const rawList = projectsData[0];
    const mapped = rawList.map((p): EnrichedProject => {
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
        category: "uncategorized" as ProjectCategory,
        imageUrl: p.imageUrl || "/images/placeholder.svg",
        contactUrl: p.link,
        ownerAddress: p.owner,
        supporterCount: Number(p.donorCount),
        totalDonated: totalDonatedNum,
        estimatedMatching: matchingNum,
        fundingState: isCancelled ? "cancelled" : finalized ? "finalized" : "estimated",
        matchingUnavailable: !estimatedMap.has(pIdStr),
        finalMatching: finalMatchingRaw === undefined ? undefined : Number(finalMatchingRaw) / 1_000_000,
        finalMatchingRaw,
        status: p.rejected ? "rejected" : p.approved ? "approved" : "pending",
        rejected: p.rejected === true,
        // Raw values for precision
        contractId: p.id,
        sumSqrtRaw: p.sumSqrt,
        totalDonatedRaw: p.totalDonated,
        estimatedMatchingRaw: matchingBigInt,
        claimed: p.claimed,
        approved: p.approved,
      };
    });
    // Trang chi tiết và bảng xếp hạng dùng chung quy tắc, không lấy ID làm hạng.
    const ranks = new Map(rankProjects(mapped).map(project => [project.id, project.supporterRank]));
    return mapped.map(project => ({ ...project, rank: ranks.get(project.id) }));
  }, [projectsData, estimatedMap, roundAddress, finalMap, finalized, isCancelled]);

  const knownEmptyRound = roundsStore(useShallow(state => Boolean(roundAddress && state.entities[roundAddress.toLowerCase()]?.fields?.results[11]?.result === 0n)));
  const mirroredProjects = projectsStore(useShallow(state => roundAddress ? state.projectsByRound[roundAddress.toLowerCase()] : undefined));
  useEffect(() => {
    if (contractData?.[0]?.status === "success") projectsStore.getState().hydrate(queriedProjects.map(storedProject), projectsUpdatedAt);
  }, [queriedProjects, projectsUpdatedAt, contractData]);
  const projects: EnrichedProject[] = useMemo(() => {
    const source = mirroredProjects ?? queriedProjects;
    const ranks = new Map(rankProjects(source).map(p => [p.id, p.supporterRank]));
    return source.map(p => ({ ...p, rank: ranks.get(p.id) }));
  }, [mirroredProjects, queriedProjects]);

  const visibleProjects = useMemo(() => {
    const categories = new Map((governance.data ?? []).flatMap(record => record.payload.kind === "category" ? [[record.payload.projectId, record.payload.category] as const] : []));
    return projects.filter(project => canViewProject(project, viewer, admin)).map(project => ({ ...project, finalizedAt, fundingState: isCancelled ? "cancelled" as const : finalized ? "finalized" as const : "estimated" as const, category: categories.get(project.id) ?? "uncategorized" as ProjectCategory }));
  }, [projects, viewer, admin, governance.data, finalizedAt, finalized, isCancelled]);

  return {
    projects: visibleProjects,
    supportsRejection,
    categoriesUnavailable: governance.isError,
    readFailureKind: contractData?.some(result => result.status === "failure" && isVersionReadError(result.error)) ? "version" as const : "rpc" as const,
    isLoading: enabled && mirroredProjects === undefined && !knownEmptyRound && Boolean(roundAddress) && ((!probeResolved && !rejectionProbe.isError) || (probeResolved && isLoading)),
    isError: (!probeResolved && rejectionProbe.isError) || isError || contractData?.[0]?.status === "failure",
    // A failed capability probe must be retried before choosing a tuple ABI.
    refetch: () => {
      if (finalized && payoutProjects.length) void finalPayouts.refetch();
      return probeResolved ? refetch() : rejectionProbe.refetch();
    },
  };
}
