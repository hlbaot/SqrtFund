"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { roundFactoryAbi } from "@/lib/contracts/abis";
import { factoryAddress, usdcAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { isVersionReadError } from "@/lib/contracts/roundReads";

/** On-chain credit survives reloads and is scoped to chain, factory, token and wallet. */
export function useInitialPoolDeposit(wallet?: Address) {
  const enabled = Boolean(wallet && factoryAddress && usdcAddress);
  const query = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "fundingVersion", chainId: TARGET_CHAIN_ID },
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "initialPoolDeposits", args: [wallet!, usdcAddress], chainId: TARGET_CHAIN_ID },
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "owner", chainId: TARGET_CHAIN_ID },
      { address: factoryAddress, abi: roundFactoryAbi, functionName: "authorizedOrganizers", args: [wallet!], chainId: TARGET_CHAIN_ID },
    ],
    query: { enabled, refetchInterval: 5000, staleTime: 0 },
  });
  const version = query.data?.[0];
  const isUnsupported = version?.status === "success" ? version.result !== 1n
    : version?.status === "failure" && isVersionReadError(version.error);
  const isOwner = Boolean(wallet && query.data?.[2]?.status === "success" && (query.data[2].result as string).toLowerCase() === wallet.toLowerCase());
  const organizer = query.data?.[3];
  // Funding-only deployments predate Organizer grants. Their owner remains authorized.
  const organizerUnsupported = organizer?.status === "failure" && isVersionReadError(organizer.error);
  return {
    isUnsupported,
    supported: query.data?.[0]?.status === "success" && query.data[0].result === 1n,
    credit: query.data?.[1]?.status === "success" ? query.data[1].result as bigint : undefined,
    isOwner,
    canDeposit: Boolean(wallet && (isOwner || (organizer?.status === "success" && organizer.result === true))),
    isLoading: enabled && query.isPending,
    isError: query.isError || Boolean(query.data?.slice(0, 3).some(result => result.status === "failure"))
      || Boolean(!isOwner && organizer?.status === "failure" && !organizerUnsupported),
    refetch: query.refetch,
  };
}
