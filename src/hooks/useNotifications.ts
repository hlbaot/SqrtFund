"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRoundRefunds } from "@/hooks/useRoundRefunds";
import { useNotificationSeen } from "@/hooks/useNotificationSeen";
import { useRole } from "@/hooks/useRole";
import { useRoundNotifications } from "@/hooks/useRoundNotifications";
import { roundProjectNotificationItems, roundLifecycleNotificationItems } from "@/lib/roundNotifications";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useOrganizerApplicationsAdmin, useMyOrganizerApplication } from "@/hooks/useOrganizerApplications";
import { useLocale } from "@/lib/context/locale";
import { buildNotificationItems } from "@/lib/notifications";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { formatUsdcFixed } from "@/lib/format";

export type NotificationType =
  | "round_ended"
  | "round_finalized"
  | "project_approved"
  | "project_rejected"
  | "project_pending"
  | "claim"
  | "refund"
  | "organizer_requested"
  | "organizer_rejected"
  | "organizer_approved"
  | "organizer_revoked";

export type NotificationEntry = {
  key: string;
  scope: "activity" | "admin";
  type: NotificationType;
  title: string;
  description: string;
  href: string;
  isRead: boolean;
  projectName?: string;
  projectId?: string;
};

export function useNotifications() {
  const { address, isConnected, chainId } = useAccount();
  const enabled = Boolean(isConnected && chainId === TARGET_CHAIN_ID && address);
  const { isReady, isAdmin, isPlatformOwner, isOrganizer } = useRole();
  const round = useRound();
  const { projects, isLoading: isProjectsLoading, isError: isProjectsError } = useProjects(round.roundAddress, { enabled });
  const refunds = useRoundRefunds(
    round.roundAddress,
    round.projectCount,
    enabled ? address : undefined,
    Boolean(enabled && round.isCancelled && !round.isError)
  );
  const { ready, keys, markSeen } = useNotificationSeen(enabled ? address : undefined);
  const myApp = useMyOrganizerApplication(enabled ? address : undefined);
  const requests = useOrganizerApplicationsAdmin("pending", enabled && isPlatformOwner);
  const roundSnapshots = useRoundNotifications(enabled ? address : undefined);
  const now = useCurrentTimestamp();
  const { t, locale } = useLocale();

  const entries = useMemo<NotificationEntry[]>(() => {
    if (!enabled || !address) return [];

    const currentItems = buildNotificationItems({
      address,
      round,
      projects: !isProjectsLoading && !isProjectsError ? projects : [],
      refundTotal: refunds.isReady ? refunds.total : 0n,
    }).filter(
      item =>
        item.scope !== "admin" ||
        isAdmin ||
        isPlatformOwner ||
        isOrganizer
    );

    // Claims/refunds giữ reader tài chính hiện có; dự án đọc toàn bộ Round.
    const rawItems = currentItems.filter(item => !item.key.startsWith("project"));
    const projectMap = new Map<string, string>();
    for (const snapshot of roundSnapshots) {
      for (const item of roundProjectNotificationItems(snapshot, address, now)) rawItems.push(item);
      rawItems.push(...roundLifecycleNotificationItems(snapshot, address, now));
      for (const project of snapshot.projects) projectMap.set(`${snapshot.roundAddress.toLowerCase()}:${project.id}`, project.name);
    }
    for (const p of projects) {
      if (p.id) projectMap.set(String(p.id).toLowerCase(), p.name);
      if (p.contractId !== undefined) projectMap.set(String(p.contractId), p.name);
    }

    const result: NotificationEntry[] = [];

    if (isPlatformOwner) for (const application of requests.applications) {
      if (application.status !== "pending") continue;
      const key = `organizerRequested:${application.id}:${application.updatedAt}`;
      result.push({ key, scope: "admin", type: "organizer_requested",
        title: t.notifications.organizerRequestedTitle,
        description: t.notifications.organizerRequestedDesc.replace("{name}", application.organizationName),
        href: "/admin?tab=platform", isRead: ready && keys.includes(key) });
    }

    // Organizer application state changes
    if (myApp.application) {
      if (myApp.isRejected) {
        const key = `organizerRejected:${myApp.application.id}:${myApp.application.updatedAt}`;
        result.push({ key, scope: "activity", type: "organizer_rejected",
          title: t.notifications.organizerRejectedTitle, description: t.notifications.organizerRejectedDesc,
          href: "/my", isRead: ready && keys.includes(key) });
      } else if (myApp.isRevoked) {
        const key = `organizerRevoked:${myApp.application.id}:${myApp.application.updatedAt}`;
        result.push({
          key,
          scope: "activity",
          type: "organizer_revoked",
          title: t.notifications.organizerRevokedTitle,
          description: myApp.application.revocationReason
            ? `${locale === "vi" ? "Lý do: " : "Reason: "}${myApp.application.revocationReason}`
            : t.notifications.organizerRevokedDesc,
          href: isPlatformOwner ? "/admin?tab=platform" : "/admin",
          isRead: ready && keys.includes(key),
        });
      } else if (myApp.isApproved) {
        const key = `organizerApproved:${myApp.application.id}:${myApp.application.updatedAt}`;
        result.push({
          key,
          scope: "activity",
          type: "organizer_approved",
          title: t.notifications.organizerApprovedTitle,
          description: t.notifications.organizerApprovedDesc,
          href: "/admin?tab=platform",
          isRead: ready && keys.includes(key),
        });
      }
    }

    for (const item of [...new Map(rawItems.map(item=>[item.key,item])).values()]) {
      const isRead = ready && keys.includes(item.key);

      if (item.key.startsWith("roundEnded:") || item.key.startsWith("roundFinalized:")) {
        const finalized = item.key.startsWith("roundFinalized:");
        const roundAddress = item.key.split(":")[1];
        result.push({ key: item.key, scope: item.scope, type: finalized ? "round_finalized" : "round_ended",
          title: finalized ? t.notifications.roundFinalizedTitle : t.notifications.roundEndedTitle,
          description: finalized ? t.notifications.roundFinalizedDesc : t.notifications.roundEndedDesc,
          href: item.scope === "admin" ? `/admin?tab=organizer&round=${roundAddress}` : `/round/${roundAddress}`, isRead });
        continue;
      }

      if (item.key.startsWith("refund:")) {
        const targetRound = item.key.split(":")[1];
        const amount = roundSnapshots.find(s=>s.roundAddress.toLowerCase()===targetRound)?.refundTotal ?? (round.roundAddress?.toLowerCase()===targetRound && refunds.isReady ? refunds.total : undefined);
        const refundAmt = amount !== undefined ? ` (${formatUsdcFixed(Number(amount)/1_000_000)})` : "";
        result.push({
          key: item.key,
          scope: item.scope,
          type: "refund",
          title: t.notifications.refundTitle,
          description: `${t.notifications.refundDesc}${refundAmt} ${locale === "vi" ? "Khoản hoàn chỉ gồm tiền ví bạn đã góp, không gồm matching." : "Your refund includes only your own contributions, without matching."}`,
          href: `/round/${targetRound}#refund`,
          isRead,
        });
        continue;
      }

      if (item.key.startsWith("projectPending:")) {
        const parts = item.key.split(":");
        const projectId = parts[2] || "";
        const name = projectMap.get(`${parts[1]}:${projectId}`) || projectMap.get(projectId.toLowerCase()) || projectMap.get(projectId) || `#${projectId}`;
        result.push({
          key: item.key,
          scope: item.scope,
          type: "project_pending",
          title: t.notifications.projectPendingTitle,
          description: t.notifications.projectPendingDesc.replace("{name}", name),
          href: `/admin?tab=organizer&round=${parts[1]}`,
          projectName: name,
          projectId,
          isRead,
        });
        continue;
      }

      if (item.key.startsWith("projectApproved:")) {
        const parts = item.key.split(":");
        const projectId = parts[2] || "";
        const name = projectMap.get(`${parts[1]}:${projectId}`) || projectMap.get(projectId.toLowerCase()) || projectMap.get(projectId) || `#${projectId}`;
        result.push({
          key: item.key,
          scope: item.scope,
          type: "project_approved",
          title: t.notifications.projectApprovedTitle,
          description: t.notifications.projectApprovedDesc.replace("{name}", name),
          href: `/round/${parts[1]}/project/${projectId}`,
          projectName: name,
          projectId,
          isRead,
        });
        continue;
      }

      if (item.key.startsWith("projectRejected:")) {
        const parts = item.key.split(":");
        const projectId = parts[2] || "";
        const name = projectMap.get(`${parts[1]}:${projectId}`) || projectMap.get(projectId.toLowerCase()) || projectMap.get(projectId) || `#${projectId}`;
        result.push({
          key: item.key,
          scope: item.scope,
          type: "project_rejected",
          title: t.notifications.projectRejectedTitle,
          description: t.notifications.projectRejectedDesc.replace("{name}", name),
          href: "/my",
          projectName: name,
          projectId,
          isRead,
        });
        continue;
      }

      if (item.key.startsWith("claim:")) {
        const parts = item.key.split(":");
        const projectId = parts[2] || "";
        const name = projectMap.get(`${parts[1]}:${projectId}`) || projectMap.get(projectId.toLowerCase()) || projectMap.get(projectId) || `#${projectId}`;
        result.push({
          key: item.key,
          scope: item.scope,
          type: "claim",
          title: t.notifications.claimReadyTitle,
          description: `${t.notifications.claimReadyDesc.replace("{name}", name)} ${locale === "vi" ? "Dùng ví chủ dự án để nhận tiền góp trực tiếp và matching đã chốt." : "Use the project owner's wallet to receive direct contributions and settled matching."}`,
          href: `/round/${parts[1]}/project/${projectId}#claim`,
          projectName: name,
          projectId,
          isRead,
        });
        continue;
      }
    }

    return result;
  }, [
    enabled,
    address,
    round,
    isProjectsLoading,
    isProjectsError,
    projects,
    refunds.isReady,
    refunds.total,
    isAdmin,
    isPlatformOwner,
    isOrganizer,
    myApp.application,
    myApp.isRevoked,
    myApp.isApproved,
    myApp.isRejected,
    requests.applications,
    roundSnapshots,
    now,
    ready,
    keys,
    t,
    locale,
  ]);

  const unreadEntries = useMemo(() => entries.filter(e => !e.isRead), [entries]);
  const unreadCount = unreadEntries.length;

  const markAsRead = (key: string) => {
    markSeen([key]);
  };

  const markAllAsRead = () => {
    markSeen(entries.map(e => e.key));
  };

  return {
    isConnected,
    isReady: ready && isReady,
    entries,
    unreadEntries,
    unreadCount,
    totalCount: entries.length,
    markAsRead,
    markAllAsRead,
  };
}
