"use client";

import { useAccount, useReadContract } from "wagmi";
import { useProjects } from "@/hooks/useProjects";
import { useRound } from "@/hooks/useRound";
import { useClaim } from "@/hooks/useClaim";
import type { WalletRole } from "@/hooks/useRole";
import { qfRoundAbi } from "@/lib/contracts/abis";

export function useNotificationCounts(role: WalletRole) {
  const { address, isConnected } = useAccount();
  const { roundAddress, finalized } = useRound();
  const { projects } = useProjects(roundAddress);
  const { claimableUsdc } = useClaim();
  const { data: requesters } = useReadContract({
    address: roundAddress,
    abi: qfRoundAbi,
    functionName: "getRequesters",
    args: [0n, 1n],
    query: { enabled: Boolean(isConnected && role === "admin" && roundAddress), refetchInterval: 30_000 },
  });
  const admin = isConnected && role === "admin"
    ? projects.filter(p => !p.approved).length + Number(requesters?.[1] ?? 0n) : 0;
  const student = isConnected && role === "student" ? claimableUsdc : 0;
  const owner = isConnected && role === "owner" && finalized
    ? projects.filter(p => p.ownerAddress.toLowerCase() === address?.toLowerCase() && p.approved && !p.claimed && p.totalDonatedRaw + p.estimatedMatchingRaw > 0n).length : 0;
  return { admin, student, owner, total: admin + student + owner };
}
