"use client";
import { RoundControls } from "@/components/admin/RoundControls";
import { RoundHistory } from "@/components/admin/RoundHistory";

import { AOSInit } from "@/components/common/AOSInit";

import { useTxFlow } from "@/hooks/useTxFlow";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { txToast } from "@/lib/txToast";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { useRound } from "@/hooks/useRound";
import { useProjects, type EnrichedProject } from "@/hooks/useProjects";
import { isPublicProject } from "@/lib/projectVisibility";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { ProjectReviewList } from "@/components/admin/ProjectReviewList";
import { ProjectModerationDialog } from "@/components/admin/ProjectModerationDialog";
import { projectModerationState, type ModerationAction } from "@/lib/projectModeration";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { getContractErrorMessage, isUserRejected } from "@/lib/errors";
import { useQueryClient } from "@tanstack/react-query";
import { formatUsdcFixed, formatCount } from "@/lib/format";
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { MintTestUsdcForm } from "@/components/admin/MintTestUsdcForm";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { AdminSkeleton } from "@/components/common/PageSkeletons";
import { Container } from "@/components/layout/Container";
import { Award } from "lucide-react";
import type { Address } from "viem";

export function AdminView() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { address, chainId, isConnected, status: accountStatus } = useAccount();
  const [selectedRound, setSelectedRound] = useState<Address>();
  const [roundBusy, setRoundBusy] = useState(false);
  const { role, isLoading: isRoleLoading, isReady } = useRole(selectedRound);
  const isAdmin = isReady && role === "admin";
  const router = useRouter();
  const round = useRound(selectedRound);
  const {
    roundAddress,
    admin: roundAdmin,
    name: roundName,
    endTime,
    isCancelled,
    finalized,
    refetch: refetchRound,
    isLoading: isRoundLoading,
  } = round;
  const { projects, supportsRejection, refetch: refetchProjects, isLoading: isProjectsLoading, isError: isProjectsError } = useProjects(roundAddress);
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const queries = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    if (accountStatus === "reconnecting" || accountStatus === "connecting" || isRoleLoading || isRoundLoading) return;
    if (!isConnected) {
      txToast.error("admin-access", t.wallet.accessDenied);
      router.replace("/");
    }
  }, [accountStatus, isRoleLoading, isRoundLoading, isConnected, isAdmin, router, t.wallet.accessDenied]);

  const [busyProjectId, setBusyProjectId] = useState<bigint | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ project: EnrichedProject; action: ModerationAction } | null>(null);
  const [reviewError, setReviewError] = useState<string>();
  const [reviewPhase, setReviewPhase] = useState<"idle" | "signing" | "confirming">("idle");
  const reviewBusy = useRef(false);
  const now = useCurrentTimestamp();
  const moderationRound = { admin: roundAdmin, endTime, finalized, isCancelled, supportsRejection };
  const viewer = isConnected && chainId === TARGET_CHAIN_ID ? address : undefined;

  useEffect(() => { setReviewTarget(null); setReviewError(undefined); }, [roundAddress, viewer]);
  const currentTarget = projects.find(project => project.id === reviewTarget?.project.id && project.roundId === reviewTarget?.project.roundId);
  const targetState = currentTarget ? projectModerationState(currentTarget, moderationRound, viewer, now) : undefined;
  const blockedReason = !reviewTarget ? undefined
    : !currentTarget || reviewTarget.project.roundId.toLowerCase() !== roundAddress?.toLowerCase() ? t.moderation.changed
    : !targetState?.showActions ? t.moderation[targetState!.reason!]
    : reviewTarget.action === "reject" && !targetState.canReject ? t.moderation.legacy : undefined;

  function openReview(project: EnrichedProject, action: ModerationAction) {
    const state = projectModerationState(project, moderationRound, viewer, now);
    if (reviewBusy.current || !state.showActions || (action === "reject" && !state.canReject)) return;
    setReviewError(undefined); setReviewPhase("idle"); setReviewTarget({ project, action });
  }

  async function confirmReview() {
    if (reviewBusy.current || !reviewTarget || !currentTarget || !roundAddress || !publicClient) return;
    const state = projectModerationState(currentTarget, moderationRound, viewer, Math.floor(Date.now() / 1000));
    if (reviewTarget.project.roundId.toLowerCase() !== roundAddress.toLowerCase()) { setReviewError(t.moderation.changed); return; }
    if (!state.showActions || (reviewTarget.action === "reject" && !state.canReject)) { setReviewError(t.moderation[state.reason || "legacy"]); return; }
    reviewBusy.current = true; setBusyProjectId(currentTarget.contractId); setReviewError(undefined); setReviewPhase("signing");
    const { action } = reviewTarget;
    const flow = beginFlow("project-review");
    const toastId = `${action}-project-${currentTarget.id}`;
    const title = action === "approve" ? t.toasts.approvingProjectTitle : t.rejection.pending;
    try {
      flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
      const hash = await flow.wait(() => writeContractAsync({ address: roundAddress, abi: qfRoundAbi, functionName: action === "approve" ? "approveProject" : "rejectProject", args: [currentTarget.contractId], chainId: TARGET_CHAIN_ID }));
      setReviewPhase("confirming"); flow.toast.pending(toastId, title, t.transactions.confirming, hash);
      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") throw new Error(t.moderation.reverted);
      flow.toast.success(toastId, action === "approve" ? t.toasts.projectApprovedTitle : t.rejection.success, currentTarget.name, hash);
      setReviewTarget(null);
      await refetchProjects(); refetchRound(); await queries.invalidateQueries();
    } catch (error) {
      if (!flow.cancelled) {
        setReviewError(isUserRejected(error) ? t.transactions.rejectedDescription : getContractErrorMessage(error, locale));
        flow.error(toastId, error, action === "approve" ? t.toasts.approvalFailed : t.rejection.failed, locale);
      }
    } finally {
      flow.finish(); reviewBusy.current = false; setBusyProjectId(null); setReviewPhase("idle");
    }
  }

  if (accountStatus === "reconnecting" || accountStatus === "connecting" || (!selectedRound && (isRoleLoading || isRoundLoading))) {
    return (
      <Container className="py-8 sm:py-10">
        <AdminSkeleton />
      </Container>
    );
  }

  // Keep the existing reserved layout while the access effect redirects guests.
  if (!isConnected) return <Container className="py-8 sm:py-10"><AdminSkeleton /></Container>;

  const approvedProjects = projects.filter(isPublicProject);

  return (
    <Container className="py-8 sm:py-10 space-y-8">
      <AOSInit />
      {/* Administration header; round actions live in one control panel. */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6"
        data-aos="fade-down"
        data-aos-duration="600"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {t.admin.title}
            </h1>
            {isAdmin && <Badge variant="primary">{t.admin.badgeAdmin}</Badge>}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            {t.admin.adminSubtitle}
          </p>
        </div>

      </div>

      <RoundControls key={`controls:${roundAddress || "no-round"}`} round={round} projects={projects}
        projectsLoading={isProjectsLoading} projectsError={isProjectsError} onSelectRound={setSelectedRound} />

      {/* Finalized Round Distribution Results Table */}
      {!isRoundLoading && finalized && !isCancelled && (
        <section
          className="border border-money/40 bg-money/10 p-6 space-y-4"
          data-aos="fade-up"
          data-aos-duration="600"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-money" />
              <h2 className="text-lg font-bold text-foreground">
                {t.admin.resultsTableTitle}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="accent">{t.admin.roundFinalizedBadge}</Badge>

            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="role-label">{t.admin.colProject}</TableHead>
                <TableHead className="role-label">{t.admin.colSupporters}</TableHead>
                <TableHead className="role-label">{t.admin.colDirectDonations}</TableHead>
                <TableHead className="role-label">{t.admin.colMatchingPayout}</TableHead>
                <TableHead className="text-right role-label">{t.admin.colTotalDisbursed}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvedProjects.map((p) => {
                const total = p.totalDonated + p.estimatedMatching;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold text-foreground">
                      {p.name}
                    </TableCell>
                    <TableCell className="font-mono text-foreground tabular-nums">
                      {formatCount(p.supporterCount)}
                    </TableCell>
                    <TableCell className="font-mono text-foreground tabular-nums">
                      {formatUsdcFixed(p.totalDonated)}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-money tabular-nums">
                      {formatUsdcFixed(p.estimatedMatching)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-black text-foreground tabular-nums">
                      {formatUsdcFixed(total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {reviewTarget && <ProjectModerationDialog key={`${reviewTarget.project.roundId}:${reviewTarget.project.id}:${reviewTarget.action}`}
        project={reviewTarget.project} action={reviewTarget.action} roundName={roundName} roundAddress={roundAddress}
        pending={busyProjectId !== null} phase={reviewPhase} blockedReason={blockedReason} error={reviewError}
        onClose={() => { if (!reviewBusy.current) { setReviewTarget(null); setReviewError(undefined); } }} onConfirm={() => void confirmReview()} />}

      {/* Project Proposals Approval Queue */}
      {isAdmin && <ProjectReviewList key={`review:${roundAddress || "no-round"}`} projects={projects} round={moderationRound} viewer={viewer} now={now}
        pending={busyProjectId !== null} isLoading={isProjectsLoading} isError={isProjectsError} onRetry={() => void refetchProjects()}
        onAction={(project, action) => { const current = projects.find(item => item.id === project.id); if (current) openReview(current, action); }} />}

      {/* Round creation takes roughly three quarters; minting sits alongside it. */}
      {isAdmin && <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)] [&>*]:min-w-0" data-aos="fade-up" data-aos-duration="600">
        <CreateRoundForm />
        <MintTestUsdcForm />
      </div>}
    </Container>
  );
}
