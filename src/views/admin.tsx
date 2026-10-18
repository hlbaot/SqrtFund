"use client";
import { RoundCancellationPanel } from "@/components/round/RoundCancellationPanel";

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
import { DepositPoolForm } from "@/components/admin/DepositPoolForm";
import { MintTestUsdcForm } from "@/components/admin/MintTestUsdcForm";
import { FinalizeButton } from "@/components/admin/FinalizeButton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminSkeleton } from "@/components/common/PageSkeletons";
import { Container } from "@/components/layout/Container";
import { Award, ArrowDownLeft } from "lucide-react";

export function AdminView() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { address, chainId, isConnected, status: accountStatus } = useAccount();
  const { role, isLoading: isRoleLoading, isReady } = useRole();
  const isAdmin = isReady && role === "admin";
  const router = useRouter();
  const {
    roundAddress,
    admin: roundAdmin,
    name: roundName,
    endTime,
    isCancelled,
    finalized,
    leftover,
    leftoverWithdrawn,
    refetch: refetchRound,
    isLoading: isRoundLoading,
  } = useRound();
  const { projects, supportsRejection, refetch: refetchProjects, isLoading: isProjectsLoading, isError: isProjectsError } = useProjects();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const queries = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    if (accountStatus === "reconnecting" || accountStatus === "connecting" || isRoleLoading || isRoundLoading) return;
    if (!isConnected || !isAdmin) {
      txToast.error("admin-access", t.wallet.accessDenied);
      router.replace("/");
    }
  }, [accountStatus, isRoleLoading, isRoundLoading, isConnected, isAdmin, router, t.wallet.accessDenied]);

  const [busyProjectId, setBusyProjectId] = useState<bigint | null>(null);
  const [isWithdrawingLeftover, setIsWithdrawingLeftover] = useState(false);
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

  // Withdraw unallocated leftover funds
  const handleWithdrawLeftover = async () => {
    const flow = beginFlow("withdraw-leftover");
    if (!roundAddress || !publicClient) return;

    const toastId = "withdraw-leftover";
    setIsWithdrawingLeftover(true);
    try {
      flow.toast.pending(
        toastId,
        t.toasts.withdrawTitle,
        t.toasts.confirmInWallet
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "withdrawLeftover",
      }));

      flow.toast.pending(
        toastId,
        t.toasts.withdrawConfirm,
        t.toasts.confirmingOnChain,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("Withdraw transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.toasts.withdrawSuccess,
        t.toasts.withdrawSuccessDesc,
        hash
      );

      refetchRound();
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        t.toasts.withdrawFailed,
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsWithdrawingLeftover(false);
      }
    }
  };

  if (accountStatus === "reconnecting" || accountStatus === "connecting" || isRoleLoading || isRoundLoading) {
    return (
      <Container className="py-8 sm:py-10">
        <AdminSkeleton />
      </Container>
    );
  }

  if (!isConnected || !isAdmin) return null;

  const approvedProjects = projects.filter(isPublicProject);
  const leftoverUsdc = Number(leftover) / 1_000_000;

  return (
    <Container className="py-8 sm:py-10 space-y-8">
      <AOSInit />
      {/* Admin Header with FinalizeButton */}
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
            <Badge variant="primary">{t.admin.badgeAdmin}</Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            {t.admin.adminSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {roundAddress && <FinalizeButton />}
        </div>
      </div>

      <RoundCancellationPanel projectNames={Object.fromEntries(projects.map(project => [project.id, project.name]))} roundAddress={roundAddress} adminControls />

      {/* Finalized Round Distribution Results Table */}
      {finalized && (
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
              {leftover > 0n && !leftoverWithdrawn && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleWithdrawLeftover}
                  disabled={isWithdrawingLeftover}
                  isLoading={isWithdrawingLeftover}
                  className="text-xs font-bold"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5 mr-1" />
                  {t.admin.withdrawLeftoverBtn} ({formatUsdcFixed(leftoverUsdc)})
                </Button>
              )}
              {leftoverWithdrawn && (
                <Badge variant="outline">{t.admin.leftoverWithdrawnBadge}</Badge>
              )}
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
      <ProjectReviewList key={roundAddress || "no-round"} projects={projects} round={moderationRound} viewer={viewer} now={now}
        pending={busyProjectId !== null} isLoading={isProjectsLoading} isError={isProjectsError} onRetry={() => void refetchProjects()}
        onAction={(project, action) => { const current = projects.find(item => item.id === project.id); if (current) openReview(current, action); }} />

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-aos="fade-up" data-aos-duration="600">
        <CreateRoundForm />
        <DepositPoolForm />
      </div>

      {/* Mint Test USDC (visible if connected wallet is MockUSDC owner) */}
      <div data-aos="fade-up" data-aos-duration="600">
        <MintTestUsdcForm />
      </div>
    </Container>
  );
}
