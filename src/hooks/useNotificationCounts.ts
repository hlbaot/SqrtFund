"use client";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useProjects } from "@/hooks/useProjects";
import { useRound } from "@/hooks/useRound";
import { useRoundRefunds } from "@/hooks/useRoundRefunds";
import { useNotificationSeen } from "@/hooks/useNotificationSeen";
import { buildNotificationItems, countUnseenNotifications } from "@/lib/notifications";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import type { WalletRole } from "@/hooks/useRole";
import { useRoundNotifications } from "@/hooks/useRoundNotifications";
import { roundLifecycleNotificationItems, roundProjectNotificationItems } from "@/lib/roundNotifications";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";

export function useNotificationCounts(role: WalletRole, { markViewed = false } = {}) {
  const { address, isConnected, chainId } = useAccount();
  const enabled = isConnected && chainId === TARGET_CHAIN_ID;
  const round = useRound();
  const { projects, isLoading, isError } = useProjects(round.roundAddress, { enabled });
  // Reuse /my's refund query keys and polling, rather than a separate RPC reader.
  const refunds = useRoundRefunds(round.roundAddress, round.projectCount, enabled ? address : undefined,
    Boolean(enabled && round.isCancelled && !round.isError));
  const { ready, keys, markSeen } = useNotificationSeen(enabled ? address : undefined);
  const snapshots = useRoundNotifications(enabled ? address : undefined);
  const now = useCurrentTimestamp();
  const items = [...buildNotificationItems({
    address: enabled ? address : undefined, round,
    projects: !isLoading && !isError ? projects : [],
    refundTotal: refunds.isReady ? refunds.total : 0n,
      now,
  }), ...snapshots.flatMap(snapshot => enabled && address ? [...roundLifecycleNotificationItems(snapshot, address, now), ...roundProjectNotificationItems(snapshot,address,now)] : [])]
    .filter(item => item.scope !== "admin" || role === "admin" || role === "platform_owner" || role === "organizer");
  // Depend on stable keys so polling does not repeatedly acknowledge unchanged items.
  const serializedKeys = JSON.stringify(items.map(item => item.key));
  const markAllSeen = () => markSeen(items.map(item => item.key));
  const counts = countUnseenNotifications(ready ? items : [], keys);
  useEffect(() => {
    if (markViewed && ready && counts.total > 0) markSeen(JSON.parse(serializedKeys) as string[]);
  }, [markViewed, ready, counts.total, markSeen, serializedKeys]);
  return { ...counts, markAllSeen };
}
