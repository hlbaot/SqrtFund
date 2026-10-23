"use client";
import { isPublicProject } from "@/lib/projectVisibility";
import { MatchingPoolWarning } from "@/components/project/MatchingPoolWarning";
import { BatchDonationForm } from "@/components/project/BatchDonationForm";
import { StudentVerifyBox } from "@/components/verify/DeferredStudentVerifyBox";

import type { Address } from "viem";
import { donationLimit } from "@/lib/studentAccess";
import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import { useAccount, useReadContract } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { tokenMatchesConfigured } from "@/lib/tokenBalance";
import { useDonate } from "@/hooks/useDonate";
import { useQueryClient } from "@tanstack/react-query";
import { formatUsdcFixed, parseUsdc } from "@/lib/format";
import { fmt } from "@/lib/copy";
import { simulateDonationImpact } from "@/lib/qf";
import { Stepper, StepItem } from "@/components/tx/Stepper";
import { TxStatusDisplay } from "@/components/tx/TxStatusToast";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/ui/Frame";
import { AlertCircle, Sparkles, Check } from "lucide-react";

export interface DonateBoxProps {
  project: Project & {
    sumSqrtRaw?: bigint;
    totalDonatedRaw?: bigint;
    contractId?: bigint;
  };
  className?: string;
  roundAddress?: Address;
}

export function DonateBox({ project, className = "", roundAddress: customRound }: DonateBoxProps) {
  const { t } = useLocale();
  const { address, isConnected } = useAccount();

  const queryClient = useQueryClient();
  const { roundAddress, token, status: roundStatus, pool, supportsPhase2, isCancelled, minDonation = 1_000_000n, maxPerRound, maxDonation = 5_000_000n, maxMatchBps = 3000n, refetch: refetchRound } = useRound(customRound);
  const { projects, refetch: refetchProjects } = useProjects(roundAddress);
  const { isStudent, canParticipate } = useRole(customRound);
  const { donate, step: donationStep, isPending: isDonatePending, activeTxHash, reset: resetDonate } = useDonate(customRound);

  const [batchMode, setBatchMode] = useState(false);
  const [amount, setAmount] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");

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

  const balance = useTokenBalance(address);
  const usdcBalanceBigInt = balance.balance;
  const usdcBalanceUsdc = Number(usdcBalanceBigInt ?? 0n) / 1_000_000;
  const tokenReady = tokenMatchesConfigured(token);
  const hasInsufficientBalance = balance.isReady && isConnected && isStudent && usdcBalanceUsdc < amount;

  const { data: roundRemaining, refetch: refetchBudget } = useReadContract({ address: roundAddress, abi: qfRoundAbi,
    functionName: "remainingBudget", args: address ? [address] : undefined,
    query: { enabled: Boolean(roundAddress && address), refetchInterval: 5000 },
  });
  const budgetReady = typeof roundRemaining === "bigint" && typeof maxPerRound === "bigint";
  const roundRemainingUsdc = Number(roundRemaining ?? 0n) / 1_000_000;
  const minDonationUsdc = Number(minDonation) / 1_000_000;
  const roundBudgetExhausted = budgetReady && roundRemaining < minDonation;
  const parsedInput = parseUsdc(inputValue);
  const limit = parsedInput.success && budgetReady ? donationLimit(parsedInput.amount, minDonation, maxDonation, userDonatedBigInt, roundRemaining) : null;
  const error = !parsedInput.success || limit === "minimum" ? fmt(t.donateBox.minMaxBounds, { min: minDonationUsdc, max: maxDonationUsdc })
    : limit === "project" ? fmt(t.donateBox.exceedsLimit, { remaining: remainingAllowanceUsdc })
    : limit === "round" ? fmt(t.donateBox.exceedsRoundBudget, { remaining: formatUsdcFixed(roundRemainingUsdc, { includeSymbol: false }) }) : "";
  const handleAmountChange = (value: string) => {
    setInputValue(value); const parsed = parseUsdc(value);
    if (parsed.success) setAmount(Number(parsed.amount) / 1_000_000);
  };
  const handleQuickSelect = (value: number) => handleAmountChange(value.toString());

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
      .filter(isPublicProject)
      .map((p) => ({
        id: p.id,
        sumSqrt: p.sumSqrtRaw ?? 0n,
        totalDonated: p.totalDonatedRaw ?? 0n,
      }));
  }, [projects, project]);

  // QF Impact preview calculated with BigInt math matching smart contracts
  const impact = useMemo(() => {
    const parsed = parseUsdc(inputValue);
    const donationAmountBigInt = parsed.success ? parsed.amount : 0n;
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

    return { nextMatching, increase, totalRaw: res.totalRaw };
  }, [project, inputValue, userDonatedBigInt, pool, allProjects, maxMatchBps]);

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
    if (!balance.isReady || !tokenReady || !parsedInput.success || !budgetReady || !canParticipate || error) return;
    const donationAmountBigInt = parsedInput.amount;
    const ok = await donate(projectIdBigInt, donationAmountBigInt);
    if (ok) {
      refetchDonation();
      refetchBudget();
      refetchProjects();
      refetchRound();
      queryClient.invalidateQueries();
    }
  };

  const isOwner = Boolean(address && project.ownerAddress && address.toLowerCase() === project.ownerAddress.toLowerCase());
  const isRoundClosed = roundStatus !== "open";
  const isMaxAllowanceReached = remainingAllowanceUsdc <= 0;

  if (project.rejected || project.status === "rejected") return <Frame className={`space-y-3 bg-surface p-5 ${className}`}><p role="status">{t.rejection.blocked}</p><Button disabled fullWidth>{t.rejection.status}</Button></Frame>;
  if (isCancelled) return <Frame className={`space-y-3 bg-surface p-5 ${className}`}><h2 className="font-bold text-primary">{t.phase2.cancelled}</h2><p className="text-sm">{t.phase2.cancelledHint}</p><Link className="underline" href={`/round/${roundAddress}`}>{t.phase2.refund}</Link></Frame>;
  if (batchMode && roundAddress && supportsPhase2) return <Frame className={`bg-surface p-5 ${className}`}><BatchDonationForm roundAddress={roundAddress} onBack={() => setBatchMode(false)} /></Frame>;
  return (
    <Frame className={`bg-surface p-5 lg:p-6 ${className}`}>
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">
            {t.donateBox.title}
          </h2>
          <p className="text-xs text-muted">{t.donateBox.subtitle}</p>
        </div>
      </div>

      {token && !tokenReady && <p role="alert">{t.tokenBalance.tokenMismatch}</p>}
      {supportsPhase2 && <Button variant="secondary" fullWidth className="mt-3" disabled={!canParticipate || isRoundClosed || isDonatePending} onClick={() => setBatchMode(true)}>{t.phase2.splitBudget}</Button>}

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

      <StudentVerifyBox />
      {isStudent && <div className="my-4 border border-line bg-bg p-3 text-sm">
        {fmt(t.donateBox.roundBudgetRemaining, { remaining: budgetReady ? formatUsdcFixed(roundRemainingUsdc, { includeSymbol: false }) : "—", max: maxPerRound === undefined ? "—" : formatUsdcFixed(Number(maxPerRound) / 1_000_000, { includeSymbol: false }) })}
      </div>}

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
                      {balance.isReady ? formatUsdcFixed(usdcBalanceUsdc) : balance.isError ? t.tokenBalance.error : balance.isLoading ? t.tokenBalance.loading : t.tokenBalance.unavailable}
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
                  min={minDonationUsdc}
                  max={remainingAllowanceUsdc}
                  step="0.000001"
                  value={inputValue}
                  disabled={isDonatePending || isRoundClosed || isOwner || isMaxAllowanceReached || !canParticipate || !budgetReady || roundBudgetExhausted}
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
                  const isDisabled = val < minDonationUsdc || val > Math.min(remainingAllowanceUsdc, roundRemainingUsdc) || isDonatePending || isRoundClosed || isOwner || !canParticipate || !budgetReady || roundBudgetExhausted;
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleQuickSelect(val)}
                      className={`border border-line px-2.5 py-2 text-xs font-bold transition-all cursor-pointer active:scale-95 ${amount === val && !error
                        ? "border-primary bg-primary text-foreground"
                        : "bg-surface-2 text-foreground hover:border-line-strong hover:bg-surface"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
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

          <p className="text-xs text-muted">{t.phase2.expectedHint}</p>
          <MatchingPoolWarning totalRaw={impact.totalRaw} pool={pool} />
          {/* Impact preview */}
          <div className="border border-money/30 bg-money/10 p-3 text-xs text-foreground">
            <div className="flex items-center gap-1.5 font-bold text-money">
              <Sparkles className="h-4 w-4" />
              <span>{t.phase2.expectedMatching}: {formatUsdcFixed(impact.nextMatching)}</span>
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
                    balance: formatUsdcFixed(usdcBalanceUsdc, { includeSymbol: false }),
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
              <Link href="/verify" className="gradient-border flex justify-center p-3 text-sm font-bold">{t.donateBox.verificationRequired}</Link>
            ) : !canParticipate ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {isStudent ? t.verification.roundNotEligible : t.donateBox.verificationRequired}
              </Button>
            ) : !budgetReady || roundBudgetExhausted ? (
              <Button variant="secondary" fullWidth disabled>{budgetReady ? t.donateBox.roundBudgetExhausted : t.common.loading}</Button>
            ) : isMaxAllowanceReached ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {fmt(t.donateBox.maxReachedBtn, { max: maxDonationUsdc })}
              </Button>
            ) : hasInsufficientBalance ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-60">
                {fmt(t.donateBox.insufficientBalanceBtn, { balance: formatUsdcFixed(usdcBalanceUsdc, { includeSymbol: false }) })}
              </Button>
            ) : (
              <Button
                variant="primary"
                fullWidth
                disabled={Boolean(error) || isDonatePending || isRoundClosed || !balance.isReady || !tokenReady}
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
