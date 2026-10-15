"use client";

import { AOSInit } from "@/components/common/AOSInit";

import { useTxFlow } from "@/hooks/useTxFlow";

import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { txToast } from "@/lib/txToast";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { formatUsdc, formatNumber } from "@/lib/format";
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { DepositPoolForm } from "@/components/admin/DepositPoolForm";
import { WhitelistTable } from "@/components/admin/WhitelistTable";
import { FinalizeButton } from "@/components/admin/FinalizeButton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminSkeleton } from "@/components/common/PageSkeletons";
import { Container } from "@/components/layout/Container";
import { Check, Award, ArrowDownLeft } from "lucide-react";

export function AdminView() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { isConnected, status: accountStatus } = useAccount();
  const { role, isLoading: isRoleLoading, isReady } = useRole();
  const isAdmin = isReady && role === "admin";
  const router = useRouter();
  const {
    roundAddress,
    finalized,
    leftover,
    leftoverWithdrawn,
    refetch: refetchRound,
    isLoading: isRoundLoading,
  } = useRound();
  const { projects, refetch: refetchProjects } = useProjects();
  const publicClient = usePublicClient();
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

  // Approve project on chain
  const handleApproveProject = async (projectId: bigint, projectName: string) => {
    const flow = beginFlow("approve-project");
    if (!roundAddress || !publicClient) return;

    const toastId = `approve-project-${projectId}`;
    setBusyProjectId(projectId);
    try {
      flow.toast.pending(
        toastId,
        t.toasts.approvingProjectTitle,
        t.toasts.approvingProjectDesc.replace("{name}", projectName)
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "approveProject",
        args: [projectId],
      }));

      flow.toast.pending(
        toastId,
        t.toasts.confirmingApprovalTitle,
        t.toasts.confirmingApprovalDesc,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("Approval transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.toasts.projectApprovedTitle,
        t.toasts.projectApprovedDesc.replace("{name}", projectName),
        hash
      );

      refetchProjects();
      refetchRound();
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        t.toasts.approvalFailed,
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setBusyProjectId(null);
      }
    }
  };

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

  const pendingProjects = projects.filter((p) => !p.approved);
  const approvedProjects = projects.filter((p) => p.approved);
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
                  {t.admin.withdrawLeftoverBtn} ({formatUsdc(leftoverUsdc)})
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
                <TableHead>{t.admin.colProject}</TableHead>
                <TableHead>{t.admin.colSupporters}</TableHead>
                <TableHead>{t.admin.colDirectDonations}</TableHead>
                <TableHead>{t.admin.colMatchingPayout}</TableHead>
                <TableHead className="text-right">{t.admin.colTotalDisbursed}</TableHead>
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
                    <TableCell className="font-mono text-foreground">
                      {formatNumber(p.supporterCount)}
                    </TableCell>
                    <TableCell className="font-mono text-foreground">
                      {formatUsdc(p.totalDonated)}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-money">
                      {formatUsdc(p.estimatedMatching)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-black text-foreground">
                      {formatUsdc(total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}

      {/* Project Proposals Approval Queue */}
      <section
        className="border border-line bg-surface p-6 space-y-4"
        data-aos="fade-up"
        data-aos-duration="600"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {t.admin.projectsQueueTitle}
          </h2>
          <span className="font-mono text-xs text-muted">
            {t.admin.pendingProjectsCount.replace("{count}", String(pendingProjects.length))}
          </span>
        </div>

        {pendingProjects.length === 0 ? (
          <div className="border border-line bg-bg p-6 text-center text-xs text-muted">
            {t.admin.noPendingProjects}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {pendingProjects.map((proj) => {
              const isBusy = busyProjectId === proj.contractId;
              return (
                <div
                  key={proj.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm">
                        {proj.name}
                      </h3>
                      <Badge variant="warning">{t.admin.pendingReviewBadge}</Badge>
                    </div>
                    <p className="text-xs text-muted max-w-lg">
                      {proj.description}
                    </p>
                    <p className="text-[11px] font-mono text-muted">
                      {t.admin.ownerLabel}: {proj.ownerAddress} | {t.admin.linkLabel}: {proj.contactUrl}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="accent"
                      disabled={Boolean(busyProjectId)}
                      isLoading={isBusy}
                      onClick={() => handleApproveProject(proj.contractId, proj.name)}
                      className="h-8 text-xs font-bold"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {t.admin.approveBtn}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Whitelist Student Approvals */}
      <div data-aos="fade-up" data-aos-duration="600">
        <WhitelistTable />
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-aos="fade-up" data-aos-duration="600">
        <CreateRoundForm />
        <DepositPoolForm />
      </div>
    </Container>
  );
}
