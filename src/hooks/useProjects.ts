"use client";

import { useMemo, useEffect } from "react";
import type { Address } from "viem";
import { useReadContracts } from "wagmi";
import { logContractReadFailure, isVersionReadError, roundReadRetry } from "@/lib/contracts/roundReads";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import type { Project, ProjectCategory } from "@/types";

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
};

export type EnrichedProject = Project & {
  contractId: bigint;
  sumSqrtRaw: bigint;
  totalDonatedRaw: bigint;
  estimatedMatchingRaw: bigint;
  claimed: boolean;
  approved: boolean;
};

export function useProjects(customRoundAddress?: Address) {
  const { roundAddress: defaultRoundAddress } = useRound(customRoundAddress);
  const roundAddress = customRoundAddress || defaultRoundAddress;

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
        abi: qfRoundAbi,
        functionName: "getProjects",
        args: [0n, 50n],
      },
      {
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "previewMatching",
      },
    ],
    query: {
      enabled: Boolean(roundAddress),
      refetchInterval: 15000,
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
        status: p.approved ? "approved" : "pending",
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
  }, [projectsData, estimatedMap, roundAddress]);

  return {
    projects,
    readFailureKind: contractData?.some(result => result.status === "failure" && isVersionReadError(result.error)) ? "version" as const : "rpc" as const,
    isLoading: Boolean(roundAddress) && isLoading,
    isError: isError || contractData?.[0]?.status === "failure",
    refetch,
  };
}
