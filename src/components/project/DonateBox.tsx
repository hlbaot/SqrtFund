"use client";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { isPublicProject } from "@/lib/projectVisibility";
import { MatchingPoolWarning } from "@/components/project/MatchingPoolWarning";
import { BatchDonationForm } from "@/components/project/BatchDonationForm";
import { StudentVerifyBox } from "@/components/verify/DeferredStudentVerifyBox";

import type { Address } from "viem";
import { isUncappedDonation } from "@/lib/donationPolicy";
import { maxUint256 } from "viem";
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
import { useWalletProfile, defaultWalletProfile } from "@/hooks/useWalletProfile";
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
import { ConnectWalletButton } from "@/components/layout/ConnectWalletButton";
import { AlertCircle, Sparkles, Check, CheckCircle2, ArrowRight } from "lucide-react";

export interface DonateBoxProps {
  project: Project & {
    sumSqrtRaw?: bigint;
    totalDonatedRaw?: bigint;
    contractId?: bigint;
  };
  className?: string;
  roundAddress?: Address;
}

export function DonateBox(props: DonateBoxProps) {
  const { address, chainId } = useAccount();
  return <DonationSession key={`${props.roundAddress}:${props.project.id}:${address}:${chainId}`} {...props} />;
}
function DonationSession({ project, className = "", roundAddress: customRound }: DonateBoxProps) {
  const { t, locale } = useLocale();
  const { address, isConnected, chainId } = useAccount();

  const queryClient = useQueryClient();
  const { roundAddress, token, status: roundStatus, pool, supportsPhase2, isCancelled, minDonation = 1_000_000n, maxPerRound, maxDonation = 5_000_000n, maxMatchBps = 3000n, refetch: refetchRound } = useRound(customRound);
  const { projects, refetch: refetchProjects } = useProjects(roundAddress);
  const { isStudent, isOrganizer, isRoundAdmin, canCreateRound, canParticipate } = useRole(customRound);
  const isOrgRole = isOrganizer || isRoundAdmin || canCreateRound;
  const { profile } = useWalletProfile(address, chainId, defaultWalletProfile(isOrgRole, isStudent));
  const isOrganizerUser = isConnected && (profile === "organizer" || (!isStudent && isOrgRole));
  const { donate, reset, step: donationStep, isPending: isDonatePending, activeTxHash } = useDonate(customRound);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [amount, setAmount] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>("1");

  // Read how much current user has already donated to this project
  const projectIdBigInt = BigInt(project.id || "1");
  const { data: userDonatedData, refetch: refetchDonation, isError: donationReadFailed } = useReadContract({
    address: roundAddress,
    abi: qfRoundAbi,
    functionName: "donationOf",
    chainId: TARGET_CHAIN_ID,
    args: address ? [address, projectIdBigInt] : undefined,
    query: {
      enabled: Boolean(roundAddress && address),
      refetchInterval: 5000,
    },
  });

  const donationReady = typeof userDonatedData === "bigint" && !donationReadFailed;
  const userDonatedBigInt = (userDonatedData as bigint | undefined) ?? 0n;
  const userDonatedUsdc = Number(userDonatedBigInt) / 1_000_000;
  const noProjectLimit = isUncappedDonation(maxDonation);
  const noRoundLimit = isUncappedDonation(maxPerRound);
  const maxDonationUsdc = Number(maxDonation) / 1_000_000;
  const remainingAllowanceUsdc = Math.max(0, maxDonationUsdc - userDonatedUsdc);

  const balance = useTokenBalance(address);
  const usdcBalanceBigInt = balance.balance;
  const usdcBalanceUsdc = Number(usdcBalanceBigInt ?? 0n) / 1_000_000;
  const tokenReady = tokenMatchesConfigured(token);

  const { data: roundRemainingData, refetch: refetchBudget, isError: budgetReadFailed } = useReadContract({ address: roundAddress, abi: qfRoundAbi,
    functionName: "remainingBudget", chainId: TARGET_CHAIN_ID, args: address ? [address] : undefined,
    query: { enabled: Boolean(roundAddress && address && !noRoundLimit), refetchInterval: 5000 },
  });
  const roundRemaining = noRoundLimit ? maxUint256 : roundRemainingData;
  const budgetReady = typeof roundRemaining === "bigint" && typeof maxPerRound === "bigint" && (noRoundLimit || !budgetReadFailed);
  const roundRemainingUsdc = Number(roundRemaining ?? 0n) / 1_000_000;
  const minDonationUsdc = Number(minDonation) / 1_000_000;
  const roundBudgetExhausted = budgetReady && roundRemaining < minDonation;
  const parsedInput = parseUsdc(inputValue);
  const hasInsufficientBalance = balance.isReady && isConnected && isStudent && parsedInput.success
    && usdcBalanceBigInt !== undefined && parsedInput.amount > usdcBalanceBigInt;
  const limit = parsedInput.success && budgetReady ? donationLimit(parsedInput.amount, minDonation, maxDonation, userDonatedBigInt, roundRemaining) : null;
  const error = !parsedInput.success ? t.donateBox.minMaxError
    : limit === "minimum" ? fmt(t.donateBox.minMaxBounds, { min: minDonationUsdc, max: maxDonationUsdc })
    : limit === "project" ? fmt(t.donateBox.exceedsLimit, { remaining: remainingAllowanceUsdc })
    : limit === "round" ? fmt(t.donateBox.exceedsRoundBudget, { remaining: formatUsdcFixed(roundRemainingUsdc, { includeSymbol: false }) }) : "";
  const handleAmountChange = (value: string) => {
    setInputValue(value); const parsed = parseUsdc(value);
    if (parsed.success) setAmount(Number(parsed.amount) / 1_000_000);
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
    if (!isConnected || !address || !balance.isReady || !tokenReady || !parsedInput.success || !budgetReady || !donationReady || isRefreshing || !canParticipate || error || hasInsufficientBalance || isRoundClosed || isOwner || isOrganizerUser) return;
    const donationAmountBigInt = parsedInput.amount;
    const ok = await donate(projectIdBigInt, donationAmountBigInt);
    if (ok) {
      setIsRefreshing(true);
      try {
        await Promise.allSettled([refetchDonation(), refetchBudget(), refetchProjects(), refetchRound(), queryClient.invalidateQueries()]);
      } finally { setIsRefreshing(false); }
    }
  };

  const isOwner = Boolean(address && project.ownerAddress && address.toLowerCase() === project.ownerAddress.toLowerCase());
  const isRoundClosed = roundStatus !== "open";
  const hasAlreadyDonated = Boolean(isConnected && userDonatedBigInt > 0n);
  const isMaxAllowanceReached = donationReady && !noProjectLimit && userDonatedBigInt >= maxDonation;

  if (!isConnected || !address) {
    return (
      <Frame className={`space-y-4 bg-surface p-5 lg:p-6 ${className}`}>
        <h2 className="text-base font-bold text-foreground">{t.common.walletRequired}</h2>
        <p className="text-sm text-muted">{t.donateBox.notConnected}</p>
        <ConnectWalletButton />
      </Frame>
    );
  }

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
      {!isOrganizerUser && !isOwner && supportsPhase2 && <Button variant="secondary" fullWidth className="mt-3" disabled={!canParticipate || isRoundClosed || isDonatePending || isRefreshing} onClick={() => setBatchMode(true)}>{t.phase2.splitBudget}</Button>}

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

      {/* Organizer cannot donate guard */}
      {isOrganizerUser && (
        <div
          role="alert"
          className="my-4 border border-line-strong bg-surface-2 p-3 text-xs text-muted"
        >
          <p className="font-semibold text-foreground">
            {locale === "vi" ? "Tài khoản Nhà tổ chức" : "Organizer Account"}
          </p>
          <p className="mt-1 leading-relaxed">
            {locale === "vi"
              ? "Vai trò Nhà tổ chức không thể tham gia quyên góp. Chỉ sinh viên đã xác thực mới có thể ủng hộ dự án."
              : "Organizer accounts cannot make donations. Only verified students can donate to projects."}
          </p>
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

      {!isOrganizerUser && !isOwner && <StudentVerifyBox />}
      {!isOwner && isStudent && !noRoundLimit && <div className="my-4 border border-line bg-bg p-3 text-sm">
        {fmt(t.donateBox.roundBudgetRemaining, { remaining: budgetReady ? formatUsdcFixed(roundRemainingUsdc, { includeSymbol: false }) : "—", max: maxPerRound === undefined ? "—" : formatUsdcFixed(Number(maxPerRound) / 1_000_000, { includeSymbol: false }) })}
      </div>}

      {/* Round cũ giữ trạng thái và giới hạn đã deploy. */}
      {hasAlreadyDonated && donationStep !== "success" && (
        <div className="mt-4 space-y-4">
          <div className="border border-money/40 bg-money/10 p-5 rounded-xs space-y-3">
            <div className="flex items-center gap-2.5 text-money font-bold text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-money" />
              <span>{t.donateBox.alreadyDonatedTitle}</span>
            </div>

            <p className="text-xs text-foreground leading-relaxed">
              {fmt(t.donateBox.alreadyDonatedDesc, {
                amount: formatUsdcFixed(userDonatedUsdc, { includeSymbol: false }),
              })}
            </p>

            <div className="flex items-center justify-between border-t border-money/20 pt-3 text-xs">
              <span className="text-muted">{t.donateBox.amountLabel}:</span>
              <span className="font-mono font-bold text-money text-sm">
                {formatUsdcFixed(userDonatedUsdc)}
              </span>
            </div>
          </div>

          <div className="pt-1">
            <Link
              href="/my"
              className="mono-label flex min-h-10 items-center justify-center gap-2 border border-line-strong bg-surface py-2.5 px-4 text-xs font-semibold text-foreground hover:border-primary hover:bg-surface-2 transition-colors cursor-pointer rounded-xs"
            >
              <span>{t.donateBox.viewMyActivity}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
      {isConnected && isMaxAllowanceReached && !isRoundClosed && (
        /* Max allowance reached alert */
        <div className="my-4 border border-money/40 bg-money/10 p-3 text-xs text-money">
          <p className="font-bold">{t.donateBox.maxReachedTitle}</p>
          <p className="mt-1 text-muted">
            {fmt(t.donateBox.maxReachedDesc, { max: maxDonationUsdc })}
          </p>
        </div>
      )}
      {!donationReady && !isOwner && isStudent && <p role="status" className="mt-3 text-xs text-muted">{donationReadFailed ? (locale === "vi" ? "Chưa đọc được tổng đã góp. Vui lòng thử lại sau." : "Unable to read your contribution total. Please retry later.") : t.common.loading}</p>}

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
                    <strong className={usdcBalanceBigInt === 0n ? "text-primary" : "text-money"}>
                      {balance.isReady ? formatUsdcFixed(usdcBalanceUsdc) : balance.isError ? t.tokenBalance.error : balance.isLoading ? t.tokenBalance.loading : t.tokenBalance.unavailable}
                    </strong>
                  </span>
                )}
                {!noProjectLimit && <span>{t.donateBox.remaining}: {formatUsdcFixed(remainingAllowanceUsdc)}</span>}
              </div>
            </div>

            <div className="relative">
              <input
                id="donation-amount"
                type="number"
                min={minDonationUsdc}
                max={noProjectLimit ? undefined : remainingAllowanceUsdc}
                step="0.000001"
                value={inputValue}
                disabled={isDonatePending || isRefreshing || !donationReady || isRoundClosed || isOwner || isOrganizerUser || isMaxAllowanceReached || !canParticipate || !budgetReady || roundBudgetExhausted}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none border border-line-strong bg-bg pl-3 pr-16 py-2 text-base font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-muted">
                USDC
              </span>
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
            {isOwner ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {t.donateBox.ownerBtn}
              </Button>
            ) : isOrganizerUser ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {locale === "vi" ? "Nhà tổ chức không thể quyên góp" : "Organizers cannot donate"}
              </Button>
            ) : !isStudent ? (
              <Link href="/verify" className="gradient-border flex justify-center p-3 text-sm font-bold">{t.donateBox.verificationRequired}</Link>
            ) : !canParticipate ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {isStudent ? t.verification.roundNotEligible : t.donateBox.verificationRequired}
              </Button>
            ) : !budgetReady || !donationReady || roundBudgetExhausted ? (
              <Button variant="secondary" fullWidth disabled>{budgetReady && donationReady && roundBudgetExhausted ? t.donateBox.roundBudgetExhausted : t.common.loading}</Button>
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
                disabled={Boolean(error) || isDonatePending || isRefreshing || isRoundClosed || !balance.isReady || !tokenReady}
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
          {!isOwner && !isOrganizerUser && <Button fullWidth variant="secondary" disabled={isRefreshing || !donationReady || !budgetReady || !canParticipate || isRoundClosed || isMaxAllowanceReached || roundBudgetExhausted} onClick={() => reset()}>{t.donateBox.donateAgain}</Button>}
        </div>
      )}
    </Frame>
  );
}
