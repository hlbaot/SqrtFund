"use client";

import { useAccount } from "wagmi";
import { useRole } from "@/hooks/useRole";
import { defaultWalletProfile, useWalletProfile } from "@/hooks/useWalletProfile";

/** Shared by all university-email entry points, not just the wallet menu. */
export function useStudentVerificationEligibility() {
  const { address, chainId, isConnected } = useAccount();
  const roles = useRole();
  const hasOrganizerAuthority = roles.isOrganizer || roles.isPlatformOwner || roles.isRoundAdmin || roles.hasManagedRounds;
  const { profile } = useWalletProfile(address, chainId, defaultWalletProfile(hasOrganizerAuthority, roles.isStudent));
  const isOrganizerProfile = hasOrganizerAuthority || profile === "organizer";
  return {
    isOrganizerProfile,
    canShowStudentIdentity: Boolean(isConnected && address && !isOrganizerProfile && !roles.isAuthorizationLoading),
  };
}
