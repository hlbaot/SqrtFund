"use client";

import { useTxFlow } from "@/hooks/useTxFlow";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi, mockUsdcAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { useDonate } from "@/hooks/useDonate";
import { useQueryClient } from "@tanstack/react-query";
import { formatUsdcFixed } from "@/lib/format";
import { fmt } from "@/lib/copy";
import { simulateDonationImpact } from "@/lib/qf";
import { Stepper, StepItem } from "@/components/tx/Stepper";
import { TxStatusDisplay } from "@/components/tx/TxStatusToast";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/ui/Frame";
import { AlertCircle, Sparkles, ShieldCheck, Check } from "lucide-react";

export interface DonateBoxProps {
  project: Project & {
    sumSqrtRaw?: bigint;
    totalDonatedRaw?: bigint;
    contractId?: bigint;
  };
  className?: string;
}

export function DonateBox({ project, className = "" }: DonateBoxProps) {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const queryClient = useQueryClient();
  const { roundAddress, token, status: roundStatus, pool, maxDonation = 5_000_000n, maxMatchBps = 3000n, refetch: refetchRound } = useRound();
  const { projects, refetch: refetchProjects } = useProjects(roundAddress);
  const { isStudent, hasRequested } = useRole();
  const { donate, step: donationStep, isPending: isDonatePending, activeTxHash, reset: resetDonate } = useDonate();

  const [amount, setAmount] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");
  const [error, setError] = useState<string>("");
  const [isRequestingVerification, setIsRequestingVerification] = useState(false);

  // Read how much current user has already donated to this project
  const projectIdBigInt = BigInt(project.id || "1");
  const { data: userDonatedData, refetch: refetchDonation } = useReadContract({
    address: roundAddress,
    abi: qfRoundAbi,
    functionName: "donationOf",
    args: address ? [address, projectIdBigInt] : undefined,
    query: {
      enabled: Boolean(roundAddress && address),
      refetchInterval: 5000,
    },
  });

  const userDonatedBigInt = (userDonatedData as bigint | undefined) ?? 0n;
  const userDonatedUsdc = Number(userDonatedBigInt) / 1_000_000;
  const maxDonationUsdc = Number(maxDonation) / 1_000_000;
  const remainingAllowanceUsdc = Math.max(0, maxDonationUsdc - userDonatedUsdc);

  // Read current user's USDC balance
  const { data: usdcBalanceData } = useReadContract({
    address: token,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(token && address),
      refetchInterval: 5000,
    },
  });

  const usdcBalanceBigInt = (usdcBalanceData as bigint | undefined) ?? 0n;
  const usdcBalanceUsdc = Number(usdcBalanceBigInt) / 1_000_000;
  const hasInsufficientBalance = isConnected && isStudent && usdcBalanceUsdc < amount;

  // Validation
  const handleAmountChange = (valStr: string) => {
    setInputValue(valStr);
    const num = parseFloat(valStr);
    if (isNaN(num)) {
      setError(t.donateBox.minMaxError);
      return;
    }
    if (num < 1 || num > 5) {
      setError(t.donateBox.minMaxError);
      return;
    }
    if (num > remainingAllowanceUsdc) {
      setError(fmt(t.donateBox.exceedsLimit, { remaining: remainingAllowanceUsdc }));
      return;
    }
    setError("");
    setAmount(num);
  };

  const handleQuickSelect = (val: number) => {
    const selected = Math.min(val, remainingAllowanceUsdc);
    setInputValue(selected.toString());
    setAmount(selected);
    setError("");
  };

  // Convert all approved round projects to ProjectMathInput format
  const allProjects = useMemo(() => {
    if (projects.length === 0) {
      return [
        {
          id: project.id,
          sumSqrt: project.sumSqrtRaw ?? 0n,
          totalDonated: project.totalDonatedRaw ?? 0n,
        },
      ];
    }
    return projects
      .filter((p) => p.approved)
      .map((p) => ({
        id: p.id,
        sumSqrt: p.sumSqrtRaw ?? 0n,
        totalDonated: p.totalDonatedRaw ?? 0n,
      }));
  }, [projects, project]);

  // QF Impact preview calculated with BigInt math matching smart contracts
  const impact = useMemo(() => {
    const donationAmountBigInt = BigInt(Math.max(1, Math.round(amount))) * 1_000_000n;
    const currentSumSqrt = project.sumSqrtRaw ?? 0n;
    const currentTotalDonated = project.totalDonatedRaw ?? 0n;

    const res = simulateDonationImpact({
      projectId: project.id,
      currentSumSqrt,
      currentTotalDonated,
      donorCurrentTotal: userDonatedBigInt,
      donationAmount: donationAmountBigInt,
      allProjects,
      pool,
      maxMatchBps: maxMatchBps ?? 3000n,
    });

    const nextMatching = Number(res.newPayout) / 1_000_000;
    const increase = Number(res.deltaPayout) / 1_000_000;

    return { nextMatching, increase };
  }, [project, amount, userDonatedBigInt, pool, allProjects, maxMatchBps]);

  // Request Student Verification
  const handleRequestVerification = async () => {
    const flow = beginFlow();
    if (!roundAddress || !publicClient) return;
    const toastId = "request-verification";
    setIsRequestingVerification(true);
    try {
      flow.toast.pending(
        toastId,
        t.toasts.requestVerifyTitle,
        t.toasts.requestVerifyDesc
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "requestVerification",
      }));

      flow.toast.pending(
        toastId,
        t.toasts.requestVerifyConfirm,
        t.toasts.requestVerifyConfirmDesc,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("requestVerification transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.toasts.requestVerifySuccess,
        t.toasts.requestVerifySuccessDesc,
        hash
      );
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        t.toasts.requestVerifyFailed,
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsRequestingVerification(false);
      }
    }
  };

  // Stepper definition
  const steps: StepItem[] = [
    {
      id: 1,
      label: t.donateBox.stepApproveTitle,
      description: t.donateBox.stepApproveSub,
      state:
        donationStep === "donating" || donationStep === "success"
          ? "completed"
          : donationStep === "approving"
            ? "current"
            : "upcoming",
    },
    {
      id: 2,
      label: t.donateBox.stepDonateTitle,
      description: `${amount} USDC`,
      state: donationStep === "success" ? "completed" : donationStep === "donating" ? "current" : "upcoming",
    },
  ];

  const handleExecuteDonate = async () => {
    const donationAmountBigInt = BigInt(Math.round(amount)) * 1_000_000n;
    const ok = await donate(projectIdBigInt, donationAmountBigInt);
    if (ok) {
      refetchDonation();
      refetchProjects();
      refetchRound();
      queryClient.invalidateQueries();
    }
  };

  const isOwner = Boolean(address && project.ownerAddress && address.toLowerCase() === project.ownerAddress.toLowerCase());
  const isRoundClosed = roundStatus !== "open";
  const isMaxAllowanceReached = remainingAllowanceUsdc <= 0;

  return (
    <Frame className={`bg-surface p-5 lg:p-6 ${className}`}>
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">
            {t.donateBox.title}
          </h2>
          <p className="text-xs text-muted">{t.donateBox.subtitle}</p>
        </div>
        <span className="mono-label border border-money/30 bg-money/10 px-2.5 py-1 text-money">
          1 - 5 USDC
        </span>
      </div>

      {/* Round Closed Banner */}
      {isRoundClosed && (
        <div
          role="alert"
          className="my-4 flex items-center gap-2 border border-line-strong bg-surface-2 p-3 text-xs text-muted"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
          <span>{t.donateBox.roundClosedMsg}</span>
        </div>
      )}

      {/* Owner self-donation guard */}
      {isOwner && (
        <div className="my-4 border border-line-strong bg-surface-2 p-3 text-xs text-muted">
          <p className="font-semibold text-foreground">{t.donateBox.ownerTitle}</p>
          <p className="mt-1 leading-relaxed">
            {t.donateBox.ownerDesc}
          </p>
        </div>
      )}

      {/* Student Verification Banner */}
      {isConnected && !isStudent && !isRoundClosed && (
        <div className="my-4 border border-line-strong bg-surface-2 p-3 text-xs text-muted space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>
              {hasRequested ? t.donateBox.waitingApprovalTitle : t.donateBox.notVerifiedTitle}
            </span>
          </div>
          <p className="leading-relaxed">
            {hasRequested
              ? t.donateBox.waitingApprovalDesc
              : t.donateBox.notVerifiedDesc}
          </p>
          {!hasRequested && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleRequestVerification}
              disabled={isRequestingVerification}
              isLoading={isRequestingVerification}
              className="text-xs font-bold"
            >
              {t.donateBox.getVerifiedCta}
            </Button>
          )}
        </div>
      )}

      {/* Max allowance reached alert */}
      {isConnected && isMaxAllowanceReached && !isRoundClosed && (
        <div className="my-4 border border-money/40 bg-money/10 p-3 text-xs text-money">
          <p className="font-bold">{t.donateBox.maxReachedTitle}</p>
          <p className="mt-1 text-muted">
            {fmt(t.donateBox.maxReachedDesc, { max: maxDonationUsdc })}
          </p>
        </div>
      )}

      {donationStep !== "success" ? (
        <div className="mt-4 space-y-4">
          {/* Amount input & Quick buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <label htmlFor="donation-amount">{t.donateBox.amountLabel}</label>
              <div className="flex items-center gap-3 font-mono text-xs text-muted">
                {isConnected && (
                  <span>
                    {t.donateBox.balance}:{" "}
                    <strong className={usdcBalanceUsdc < 1 ? "text-primary" : "text-money"}>
                      {formatUsdcFixed(usdcBalanceUsdc)}
                    </strong>
                  </span>
                )}
                <span>{t.donateBox.remaining}: {formatUsdcFixed(remainingAllowanceUsdc)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="donation-amount"
                  type="number"
                  min="1"
                  max={remainingAllowanceUsdc}
                  step="1"
                  value={inputValue}
                  disabled={isDonatePending || isRoundClosed || isOwner || isMaxAllowanceReached || !isStudent}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full border border-line-strong bg-bg px-3 py-2 text-base font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
                <span className="pointer-events-none absolute right-3 top-2.5 text-xs font-bold text-muted">
                  USDC
                </span>
              </div>

              {/* Quick Buttons capped at remaining allowance */}
              <div className="flex gap-1.5">
                {[1, 2, 5].map((val) => {
                  const isDisabled = val > remainingAllowanceUsdc || isDonatePending || isRoundClosed || isOwner || !isStudent;
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleQuickSelect(val)}
                      className={`border border-line px-2.5 py-2 text-xs font-bold transition-colors ${amount === val && !error
                        ? "border-primary bg-primary text-foreground"
                        : "bg-surface-2 text-foreground hover:border-line-strong"
                        } disabled:opacity-30`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-primary" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Impact preview */}
          <div className="border border-money/30 bg-money/10 p-3 text-xs text-foreground">
            <div className="flex items-center gap-1.5 font-bold text-money">
              <Sparkles className="h-4 w-4" />
              <span>{t.donateBox.impactPreview}</span>
            </div>
            <p className="mt-1 leading-relaxed text-foreground">
              {fmt(t.donateBox.impactText, {
                amount: amount.toString(),
                current: formatUsdcFixed(project.estimatedMatching),
                next: formatUsdcFixed(impact.nextMatching),
                diff: formatUsdcFixed(impact.increase),
              })}
            </p>
          </div>

          {/* Honest copy about 2 sequential confirmations */}
          <p className="text-xs text-muted leading-relaxed">
            {t.donateBox.approvalNotice}
          </p>

          {/* Stepper visualization */}
          <div className="pt-1">
            <Stepper steps={steps} />
          </div>

          {/* Tx Status during pending/error */}
          {activeTxHash && (
            <TxStatusDisplay
              status={isDonatePending ? "confirming" : "idle"}
              txHash={activeTxHash}
            />
          )}

          {/* Insufficient balance alert */}
          {isConnected && isStudent && hasInsufficientBalance && (
            <div className="flex items-start gap-2.5 border border-primary/40 bg-primary/10 p-3 text-xs text-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <div className="leading-snug space-y-1">
                <p className="font-semibold text-primary">
                  {t.donateBox.insufficientBalanceTitle}
                </p>
                <p className="text-muted">
                  {fmt(t.donateBox.insufficientBalanceDesc, {
                    balance: formatUsdcFixed(usdcBalanceUsdc),
                    amount: amount,
                  })}
                </p>
                <Link
                  href="/my"
                  className="inline-flex items-center gap-1 font-bold text-primary underline hover:opacity-80 pt-0.5"
                >
                  {t.donateBox.claimFaucetLink} &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <div>
            {!isConnected ? (
              <Button
                variant="primary"
                fullWidth
                disabled
                className="py-3 text-sm font-bold opacity-60"
              >
                {t.donateBox.notConnected}
              </Button>
            ) : isOwner ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {t.donateBox.ownerBtn}
              </Button>
            ) : !isStudent ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {hasRequested ? t.donateBox.waitingApprovalTitle : t.donateBox.verificationRequired}
              </Button>
            ) : isMaxAllowanceReached ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {fmt(t.donateBox.maxReachedBtn, { max: maxDonationUsdc })}
              </Button>
            ) : hasInsufficientBalance ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-60">
                {fmt(t.donateBox.insufficientBalanceBtn, { balance: formatUsdcFixed(usdcBalanceUsdc) })}
              </Button>
            ) : (
              <Button
                variant="primary"
                fullWidth
                disabled={Boolean(error) || isDonatePending || isRoundClosed}
                isLoading={isDonatePending}
                onClick={handleExecuteDonate}
                className="py-3 text-sm font-bold"
              >
                {donationStep === "approving"
                  ? t.donateBox.approvingStep
                  : donationStep === "donating"
                    ? t.donateBox.confirmingDonation
                    : fmt(t.donateBox.donateBtn, { amount })}
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Completed Transaction Card */
        <div className="mt-4 space-y-4 border border-money/30 bg-money/10 p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center border border-money/40 bg-money/10 text-money">
            <Check className="h-6 w-6 stroke-[3]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {t.donateBox.txSuccess}
            </h4>
            <p className="mt-1 text-xs text-foreground">
              {fmt(t.donateBox.matchingIncrease, { amount: formatUsdcFixed(impact.increase) })}
            </p>
          </div>
          {activeTxHash && <TxStatusDisplay status="success" txHash={activeTxHash} />}
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={resetDonate}
          >
            {t.donateBox.donateAgain}
          </Button>
        </div>
      )}
    </Frame>
  );
}
