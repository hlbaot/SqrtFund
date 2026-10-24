"use client";

import type { Address } from "viem";
import { studentCanParticipate } from "@/lib/studentAccess";
import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { TARGET_CHAIN_ID, ZERO_ADDRESS, studentRegistryAddress } from "@/lib/contracts/addresses";
import { useRound } from "@/hooks/useRound";
import { useStudentStatus } from "@/hooks/useStudentStatus";
import { useProjects } from "@/hooks/useProjects";
import { useAdminRounds } from "@/hooks/useAdminRounds";

export type WalletRole = "platform_owner" | "organizer" | "admin" | "student" | "owner" | "guest";
export type RoleReadStatus = "inactive" | "loading" | "error" | "confirmed" | "absent" | "unsupported";

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
    isOrganizer: isOrganizerFromRound,
    studentRegistry: roundRegistry,
    isAuthorizationLoading: isFactoryAuthorizationLoading,
    isAuthorizationError: isFactoryAuthorizationError,
    isLegacyFactory,
    refetch: refetchRoleRound,
  } = useRound(customRound, address);
  const { projects } = useProjects(roundAddress, { enabled: Boolean(address && isConnected && chainId === TARGET_CHAIN_ID) });
  const student = useStudentStatus();
  const isTargetChain = chainId === TARGET_CHAIN_ID;

  const hasConnectedTargetAccount = Boolean(address && isConnected && isTargetChain);
  const managed = useAdminRounds(hasConnectedTargetAccount ? address : undefined);
  // Thu hồi Organizer chỉ chặn tạo vòng mới; quyền quản lý vòng cũ vẫn còn.
  const hasManagedRounds = hasConnectedTargetAccount && managed.rounds.length > 0;
  const canParticipate = studentCanParticipate(hasConnectedTargetAccount, student.isStudent, String(roundRegistry ?? "").toLowerCase() === studentRegistryAddress.toLowerCase() && !isCancelled);

  // Platform Owner is the owner of RoundFactory (owner() from Ownable)
  const isPlatformOwner = useMemo(() => {
    if (!hasConnectedTargetAccount || !address || !factoryOwner) return false;
    return isNonZero(factoryOwner) && address.toLowerCase() === factoryOwner.toLowerCase();
  }, [address, factoryOwner, hasConnectedTargetAccount]);

  const isOrganizer = useMemo(() => {
    if (!hasConnectedTargetAccount || !address) return false;
    return Boolean(isOrganizerFromRound);
  }, [hasConnectedTargetAccount, address, isOrganizerFromRound]);

  // Round Admin is the admin of the active or custom QFRound
  const isRoundAdmin = useMemo(() => {
    if (!hasConnectedTargetAccount || !address || !admin) return false;
    return isNonZero(admin) && address.toLowerCase() === admin.toLowerCase();
  }, [address, admin, hasConnectedTargetAccount]);

  // Combined administrative and creation capabilities
  const canCreateRound = (isPlatformOwner || isOrganizer) && !isLegacyFactory && !isFactoryAuthorizationError;
  const canManagePlatform = isPlatformOwner;
  const canManageSelectedRound = isRoundAdmin;

  // isAdmin remains true for any administrative or organizer authority
  const isAdmin = isPlatformOwner || isOrganizer || isRoundAdmin || hasManagedRounds;

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

  // List of all active roles for the connected wallet
  const roles = useMemo<WalletRole[]>(() => {
    if (!hasConnectedTargetAccount || !address) return ["guest"];
    const list: WalletRole[] = [];
    if (isPlatformOwner) list.push("platform_owner");
    if (isOrganizer) list.push("organizer");
    if (isRoundAdmin || hasManagedRounds) list.push("admin");
    if (isStudent) list.push("student");
    if (isProjectOwner) list.push("owner");
    if (list.length === 0) list.push("guest");
    return list;
  }, [hasConnectedTargetAccount, address, isPlatformOwner, isOrganizer, isRoundAdmin, hasManagedRounds, isStudent, isProjectOwner]);

  // Primary single role: preserves "admin" if isAdmin for backward compatibility
  const role: WalletRole = isAdmin ? "admin"
    : isProjectOwner ? "owner"
    : isStudent ? "student"
    : "guest";

  // Privileged users (Platform Owner / Organizer / Round Admin) don't get blocked by student registry failures
  const isPrivileged = isAdmin;
  const isLoading = !isPrivileged && student.isLoading;
  const isError = !isPrivileged && student.isError;
  // Quyền sinh viên độc lập; Dashboard phải đợi truy vấn quyền quản trị riêng.
  const isAuthorizationLoading = Boolean(hasConnectedTargetAccount && !isAdmin && (isFactoryAuthorizationLoading || managed.isLoading));
  const isAuthorizationError = Boolean(hasConnectedTargetAccount && !isAdmin && (isFactoryAuthorizationError || managed.isError));
  // Hiển thị từng quyền độc lập: lỗi Factory không che kết quả xác minh sinh viên.
  const studentStatus: RoleReadStatus = !hasConnectedTargetAccount ? "inactive"
    : student.isLoading ? "loading"
    : student.isError || !student.isConfigured ? "error"
    : isStudent ? "confirmed" : "absent";
  const organizerStatus: RoleReadStatus = !hasConnectedTargetAccount ? "inactive"
    : isOrganizer ? "confirmed"
    : isFactoryAuthorizationLoading ? "loading"
    : isLegacyFactory ? "unsupported"
    : isFactoryAuthorizationError ? "error" : "absent";

  return {
    isConnected,
    address,
    chainId,
    isPlatformOwner,
    isOrganizer,
    isRoundAdmin,
    hasManagedRounds,
    isAuthorizationLoading,
    isAuthorizationError,
    isAuthorizationReady: !isAuthorizationLoading && !isAuthorizationError,
    isLegacyFactory: Boolean(isLegacyFactory),
    isFactoryAuthorizationError: Boolean(isFactoryAuthorizationError),
    refetchAuthorization: () => { managed.refetch(); refetchRoleRound(); },
    canCreateRound,
    canManagePlatform,
    canManageSelectedRound,
    isAdmin,
    isFactoryOwner: isPlatformOwner,
    isStudent,
    studentStatus,
    organizerStatus,
    refetchWalletRoles: () => { managed.refetch(); refetchRoleRound(); void student.refetch(); },
    canParticipate,
    isProjectOwner,
    myProjectIds,
    myProjects,
    roles,
    role,
    isLoading,
    isError,
    isReady: !isLoading && !isError,
  };
}


