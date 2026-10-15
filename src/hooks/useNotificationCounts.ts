"use client";

import { useAccount } from "wagmi";
import { useProjects } from "@/hooks/useProjects";
import { useRound } from "@/hooks/useRound";
import { useClaim } from "@/hooks/useClaim";
import type { WalletRole } from "@/hooks/useRole";
import { usePendingRequests } from "@/hooks/usePendingRequests";

export function useNotificationCounts(role: WalletRole) {
  const { address, isConnected } = useAccount();
  const { roundAddress, finalized } = useRound();
  const { projects } = useProjects(roundAddress);
  const { claimableUsdc } = useClaim();
  const { totalCount } = usePendingRequests(0n, 0n, isConnected && role === "admin");
  const admin = isConnected && role === "admin"
    ? projects.filter(p => !p.approved).length + totalCount : 0;
  const student = isConnected && role === "student" ? claimableUsdc : 0;
  const owner = isConnected && role === "owner" && finalized
    ? projects.filter(p => p.ownerAddress.toLowerCase() === address?.toLowerCase() && p.approved && !p.claimed && p.totalDonatedRaw + p.estimatedMatchingRaw > 0n).length : 0;
  return { admin, student, owner, total: admin + student + owner };
}
