"use client";

import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useToast } from "@/lib/context/toast";
import { useRole } from "@/hooks/useRole";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { formatUsdc, formatNumber } from "@/lib/format";
import { getContractErrorMessage } from "@/lib/errors";
import { CreateRoundForm } from "@/components/admin/CreateRoundForm";
import { DepositPoolForm } from "@/components/admin/DepositPoolForm";
import { WhitelistTable } from "@/components/admin/WhitelistTable";
import { FinalizeButton } from "@/components/admin/FinalizeButton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AdminSkeleton } from "@/components/common/PageSkeletons";
import { ShieldAlert, Check, Award, ArrowDownLeft } from "lucide-react";

export function AdminView() {
  const { t } = useLocale();
  const { isConnected, address } = useAccount();
  const { isAdmin, isLoading: isRoleLoading } = useRole();
  const {
    roundAddress,
    finalized,
    leftover,
    leftoverWithdrawn,
    refetch: refetchRound,
    isLoading: isRoundLoading,
  } = useRound();
  const { projects, refetch: refetchProjects } = useProjects();
  const { addToast } = useToast();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [busyProjectId, setBusyProjectId] = useState<bigint | null>(null);
  const [isWithdrawingLeftover, setIsWithdrawingLeftover] = useState(false);

  // Approve project on chain
  const handleApproveProject = async (projectId: bigint, projectName: string) => {
    if (!roundAddress || !publicClient) return;

    setBusyProjectId(projectId);
    try {
      addToast({
        type: "pending",
        title: "Approving project...",
        description: `Approving ${projectName} to participate in round.`,
      });

      const hash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "approveProject",
        args: [projectId],
      });

      addToast({
        type: "pending",
        title: "Confirming approval...",
        txHash: hash,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      addToast({
        type: "success",
        title: "Project approved!",
        description: `${projectName} is now active and ready to receive student donations.`,
        txHash: hash,
      });

      refetchProjects();
      refetchRound();
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Project approval failed",
        description: msg,
      });
    } finally {
      setBusyProjectId(null);
    }
  };

  // Withdraw unallocated leftover funds
  const handleWithdrawLeftover = async () => {
    if (!roundAddress || !publicClient) return;

    setIsWithdrawingLeftover(true);
    try {
      addToast({
        type: "pending",
        title: "Withdrawing leftover pool...",
        description: "Please confirm in your wallet.",
      });

      const hash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "withdrawLeftover",
      });

      addToast({
        type: "pending",
        title: "Confirming withdrawal...",
        txHash: hash,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      addToast({
        type: "success",
        title: "Leftover withdrawn!",
        description: "Unallocated matching pool funds transferred to admin address.",
        txHash: hash,
      });

      refetchRound();
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Withdraw failed",
        description: msg,
      });
    } finally {
      setIsWithdrawingLeftover(false);
    }
  };

  if (isRoleLoading || isRoundLoading) {
    return <AdminSkeleton />;
  }

  // Gate: visible only to round admin or factory owner
  if (!isConnected || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          Admin wallet required
        </h1>
        <p className="text-sm text-muted leading-relaxed">
          {t.admin.restrictedMsg}
        </p>
        <p className="mono-label text-xs text-muted">
          Connected address: {address ? address : "Not connected"}
        </p>
      </div>
    );
  }

  const pendingProjects = projects.filter((p) => !p.approved);
  const approvedProjects = projects.filter((p) => p.approved);
  const leftoverUsdc = Number(leftover) / 1_000_000;

  return (
    <div className="space-y-8">
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
            <Badge variant="primary">Round Admin</Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Manage rounds, fund matching pools, verify students, and finalize allocations.
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
              <Badge variant="accent">Finalized</Badge>
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
                  Withdraw Leftover ({formatUsdc(leftoverUsdc)})
                </Button>
              )}
              {leftoverWithdrawn && (
                <Badge variant="outline">Leftover Withdrawn</Badge>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Supporters</TableHead>
                <TableHead>Direct Donations</TableHead>
                <TableHead>Matching Payout</TableHead>
                <TableHead className="text-right">Total Disbursed</TableHead>
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
            {pendingProjects.length} pending
          </span>
        </div>

        {pendingProjects.length === 0 ? (
          <div className="border border-line bg-bg p-6 text-center text-xs text-muted">
            No pending project proposals currently waiting for review.
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
                      <Badge variant="warning">Pending review</Badge>
                    </div>
                    <p className="text-xs text-muted max-w-lg">
                      {proj.description}
                    </p>
                    <p className="text-[11px] font-mono text-muted">
                      Owner: {proj.ownerAddress} | Link: {proj.contactUrl}
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
                      Approve
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
    </div>
  );
}
