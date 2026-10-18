"use client";
import { isPendingProject } from "@/lib/projectVisibility";

import { useAccount } from "wagmi";
import { useProjects } from "@/hooks/useProjects";
import { useRound } from "@/hooks/useRound";
import { useClaim } from "@/hooks/useClaim";
import type { WalletRole } from "@/hooks/useRole";

export function useNotificationCounts(role: WalletRole) {
  const { address, isConnected } = useAccount();
  const { roundAddress, finalized } = useRound();
  const { projects } = useProjects(roundAddress, { enabled: isConnected && (role === "admin" || role === "owner") });
  const { claimableUsdc } = useClaim();
  const admin = isConnected && role === "admin"
    ? projects.filter(isPendingProject).length : 0;
  const student = isConnected && role === "student" ? claimableUsdc : 0;
  const owner = isConnected && role === "owner" && finalized
    ? projects.filter(p => p.ownerAddress.toLowerCase() === address?.toLowerCase() && p.approved && !p.claimed && p.totalDonatedRaw + p.estimatedMatchingRaw > 0n).length : 0;
  return { admin, student, owner, total: admin + student + owner };
}
