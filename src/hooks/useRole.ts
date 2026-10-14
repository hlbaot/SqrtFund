"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";

export function useRole() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { roundAddress, admin, factoryOwner } = useRound();
  const { projects } = useProjects(roundAddress);
  const isTargetChain = chainId === TARGET_CHAIN_ID;

  const { data, isLoading } = useReadContracts({
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
    },
  });

  const hasConnectedTargetAccount = Boolean(address && isConnected && isTargetChain);
  const isWhitelisted = hasConnectedTargetAccount && Boolean(data?.[0]?.result);
  const hasRequested = hasConnectedTargetAccount && Boolean(data?.[1]?.result);

  const isAdmin = useMemo(() => {
    if (!hasConnectedTargetAccount || !address) return false;
    const addr = address.toLowerCase();
    const adminAddr = admin?.toLowerCase();
    const factoryOwnerAddr = factoryOwner?.toLowerCase();
    return addr === adminAddr || (!admin && addr === factoryOwnerAddr);
  }, [address, admin, factoryOwner, hasConnectedTargetAccount]);

  const isFactoryOwner = useMemo(() => {
    if (!hasConnectedTargetAccount || !address || !factoryOwner) return false;
    return address.toLowerCase() === factoryOwner.toLowerCase();
  }, [address, factoryOwner, hasConnectedTargetAccount]);

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
    isLoading: hasConnectedTargetAccount && isLoading,
  };
}
