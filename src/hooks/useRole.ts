"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { TARGET_CHAIN_ID, ZERO_ADDRESS } from "@/lib/contracts/addresses";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";

export type WalletRole = "admin" | "student" | "owner" | "guest";

/** Helper: treat undefined and 0x000...0 as "not set" */
const isNonZero = (addr: string | undefined): addr is string =>
  Boolean(addr && addr.toLowerCase() !== ZERO_ADDRESS.toLowerCase());

export function useRole() {
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const {
    roundAddress,
    admin,
    factoryOwner,
    isLoading: isRoundLoading,
    isError: isRoundError,
  } = useRound();
  const { projects, isLoading: isProjectsLoading, isError: isProjectsError } = useProjects(roundAddress);
  const isTargetChain = chainId === TARGET_CHAIN_ID;

  const { data, isLoading: isWhitelistLoading, isError: isWhitelistError } = useReadContracts({
    contracts: [
      {
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "isWhitelisted",
        args: address ? [address] : undefined,
      },
      {
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "requested",
        args: address ? [address] : undefined,
      },
    ],
    query: {
      enabled: Boolean(roundAddress && address && isConnected && isTargetChain),
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
    },
  });

  const hasConnectedTargetAccount = Boolean(address && isConnected && isTargetChain);
  const isWhitelisted = hasConnectedTargetAccount && Boolean(data?.[0]?.result);
  const hasRequested = hasConnectedTargetAccount && Boolean(data?.[1]?.result);

  const ownerForCheck = factoryOwner;

  const isAdmin = useMemo(() => {
    if (!hasConnectedTargetAccount || !address) return false;
    const addr = address.toLowerCase();
    if (isNonZero(admin) && addr === admin.toLowerCase()) return true;
    if (isNonZero(ownerForCheck) && addr === ownerForCheck.toLowerCase()) return true;
    return false;
  }, [address, admin, ownerForCheck, hasConnectedTargetAccount]);

  const isFactoryOwner = useMemo(() => {
    if (!hasConnectedTargetAccount || !address || !ownerForCheck) return false;
    return address.toLowerCase() === ownerForCheck.toLowerCase();
  }, [address, ownerForCheck, hasConnectedTargetAccount]);

  const isStudent = isWhitelisted;

  const myProjects = useMemo(() => {
    if (!hasConnectedTargetAccount || !address) return [];
    const addr = address.toLowerCase();
    return projects.filter((p) => p.ownerAddress.toLowerCase() === addr);
  }, [address, projects, hasConnectedTargetAccount]);

  const myProjectIds = useMemo(() => {
    return myProjects.map((p) => p.id);
  }, [myProjects]);

  const isProjectOwner = myProjects.length > 0;

  const isLoading = hasConnectedTargetAccount && (isRoundLoading || isWhitelistLoading || isProjectsLoading);
  const isError = hasConnectedTargetAccount && (isRoundError || isWhitelistError || isProjectsError ||
    Boolean(roundAddress && data?.some(result => result.status === "failure")));
  const role: WalletRole = !isLoading && !isError && isAdmin ? "admin"
    : isProjectOwner ? "owner" : isStudent ? "student" : "guest";

  return {
    isConnected,
    address,
    isAdmin,
    isFactoryOwner,
    isStudent,
    hasRequested,
    isProjectOwner,
    myProjectIds,
    myProjects,
    role,
    isLoading,
    isError,
    isReady: !isLoading && !isError,
  };
}