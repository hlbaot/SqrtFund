"use client";

import type { Address } from "viem";
import { studentCanParticipate } from "@/lib/studentAccess";
import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { TARGET_CHAIN_ID, ZERO_ADDRESS, studentRegistryAddress } from "@/lib/contracts/addresses";
import { useRound } from "@/hooks/useRound";
import { useStudentStatus } from "@/hooks/useStudentStatus";
import { useProjects } from "@/hooks/useProjects";

export type WalletRole = "admin" | "student" | "owner" | "guest";

/** Helper: treat undefined and 0x000...0 as "not set" */
const isNonZero = (addr: string | undefined): addr is string =>
  Boolean(addr && addr.toLowerCase() !== ZERO_ADDRESS.toLowerCase());

export function useRole(customRound?: Address) {
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const {
    roundAddress,
    admin,
    isCancelled,
    factoryOwner,
    studentRegistry: roundRegistry,
  } = useRound(customRound);
  const { projects } = useProjects(roundAddress);
  const student = useStudentStatus();
  const isTargetChain = chainId === TARGET_CHAIN_ID;

  const hasConnectedTargetAccount = Boolean(address && isConnected && isTargetChain);
  const canParticipate = studentCanParticipate(hasConnectedTargetAccount, student.isStudent, String(roundRegistry ?? "").toLowerCase() === studentRegistryAddress.toLowerCase() && !isCancelled);

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

  const isStudent = student.isStudent;

  const myProjects = useMemo(() => {
    if (!hasConnectedTargetAccount || !address) return [];
    const addr = address.toLowerCase();
    return projects.filter((p) => p.ownerAddress.toLowerCase() === addr);
  }, [address, projects, hasConnectedTargetAccount]);

  const myProjectIds = useMemo(() => {
    return myProjects.map((p) => p.id);
  }, [myProjects]);

  const isProjectOwner = myProjects.length > 0;

  // Round/project failures affect participation, not the global identity badge.
  // Factory/round authority is independent of student verification. A slow or
  // failed registry read must not hide an already established admin identity.
  const isLoading = !isAdmin && student.isLoading;
  const isError = !isAdmin && student.isError;
  const role: WalletRole = isAdmin ? "admin"
    : isProjectOwner ? "owner" : isStudent ? "student" : "guest";

  return {
    isConnected,
    address,
    isAdmin,
    isFactoryOwner,
    isStudent,
    canParticipate,
    isProjectOwner,
    myProjectIds,
    myProjects,
    role,
    isLoading,
    isError,
    isReady: !isLoading && !isError,
  };
}