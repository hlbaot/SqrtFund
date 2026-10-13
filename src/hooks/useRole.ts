"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";

export function useRole() {
  const { address, isConnected } = useAccount();
  const { roundAddress, admin, factoryOwner } = useRound();
  const { projects } = useProjects(roundAddress);

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
      enabled: Boolean(roundAddress && address),
      refetchInterval: 5000,
    },
  });

  const isWhitelisted = Boolean(data?.[0]?.result);
  const hasRequested = Boolean(data?.[1]?.result);

  const isAdmin = useMemo(() => {
    if (!address) return false;
    const addr = address.toLowerCase();
    const adminAddr = admin?.toLowerCase();
    const factoryOwnerAddr = factoryOwner?.toLowerCase();
    return addr === adminAddr || (!admin && addr === factoryOwnerAddr);
  }, [address, admin, factoryOwner]);

  const isFactoryOwner = useMemo(() => {
    if (!address || !factoryOwner) return false;
    return address.toLowerCase() === factoryOwner.toLowerCase();
  }, [address, factoryOwner]);

  const isStudent = isWhitelisted;

  const myProjects = useMemo(() => {
    if (!address) return [];
    const addr = address.toLowerCase();
    return projects.filter((p) => p.ownerAddress.toLowerCase() === addr);
  }, [address, projects]);

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
    isLoading,
  };
}
