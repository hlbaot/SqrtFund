"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi, mockUsdcAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useToast } from "@/lib/context/toast";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRole } from "@/hooks/useRole";
import { useDonate } from "@/hooks/useDonate";
import { useQueryClient } from "@tanstack/react-query";
import { formatUsdc } from "@/lib/format";
import { simulateDonationImpact } from "@/lib/qf";
import { Stepper, StepItem } from "@/components/tx/Stepper";
import { TxStatusDisplay } from "@/components/tx/TxStatusToast";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/ui/Frame";
import { AlertCircle, Sparkles, ShieldCheck, Check } from "lucide-react";
import { getContractErrorMessage } from "@/lib/errors";

export interface DonateBoxProps {
  project: Project & {
    sumSqrtRaw?: bigint;
    totalDonatedRaw?: bigint;
    contractId?: bigint;
  };
  className?: string;
}

export function DonateBox({ project, className = "" }: DonateBoxProps) {
  const { t, locale } = useLocale();
  const { address, isConnected } = useAccount();
  const { addToast } = useToast();
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
      setError(`Amount exceeds your remaining limit of ${remainingAllowanceUsdc} USDC for this project.`);
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
    if (!roundAddress || !publicClient) return;
    setIsRequestingVerification(true);
    try {
      addToast({
        type: "pending",
        title: "Requesting verification...",
        description: "Please confirm in your wallet.",
      });

      const hash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "requestVerification",
      });

      addToast({
        type: "pending",
        title: "Confirming request...",
        description: "Adding your wallet to the verification queue.",
        txHash: hash,
      });

      await publicClient.waitForTransactionReceipt({ hash });

      addToast({
        type: "success",
        title: "Verification requested!",
        description: "Your request is now pending admin review.",
        txHash: hash,
      });
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Request failed",
        description: msg,
      });
    } finally {
      setIsRequestingVerification(false);
    }
  };

  // Stepper definition
  const steps: StepItem[] = [
    {
      id: 1,
      label: "Approve token",
      description: "Allowance",
      state:
        donationStep === "donating" || donationStep === "success"
          ? "completed"
          : donationStep === "approving"
          ? "current"
          : "upcoming",
    },
    {
      id: 2,
      label: "Donate",
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
          <p className="font-semibold text-foreground">Project Owner Wallet</p>
          <p className="mt-1 leading-relaxed">
            Quadratic funding rules prevent project owners from donating to their own project.
          </p>
        </div>
      )}

      {/* Student Verification Banner */}
      {isConnected && !isStudent && !isRoundClosed && (
        <div className="my-4 border border-line-strong bg-surface-2 p-3 text-xs text-muted space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>
              {hasRequested ? "Waiting for admin approval" : t.donateBox.notVerifiedTitle}
            </span>
          </div>
          <p className="leading-relaxed">
            {hasRequested
              ? "Your wallet verification request has been submitted. The admin will review and approve your address shortly."
              : "Only whitelisted student wallets can donate. Click below to request verification from the round admin."}
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
              Request verification
            </Button>
          )}
        </div>
      )}

      {/* Max allowance reached alert */}
      {isConnected && isMaxAllowanceReached && !isRoundClosed && (
        <div className="my-4 border border-money/40 bg-money/10 p-3 text-xs text-money">
          <p className="font-bold">Maximum Donation Limit Reached</p>
          <p className="mt-1 text-muted">
            You have already donated the maximum allowed 5 USDC to this project across all contributions. Thank you for your support!
          </p>
        </div>
      )}

      {donationStep !== "success" ? (
        <div className="mt-4 space-y-4">
          {/* Amount input & Quick buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <label htmlFor="donation-amount">{t.donateBox.amountLabel}</label>
              <div className="flex items-center gap-3 font-mono text-[11px] text-muted">
                {isConnected && (
                  <span>
                    Balance:{" "}
                    <strong className={usdcBalanceUsdc < 1 ? "text-primary" : "text-money"}>
                      {usdcBalanceUsdc.toFixed(0)} USDC
                    </strong>
                  </span>
                )}
                <span>Remaining: {remainingAllowanceUsdc} USDC</span>
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
                      className={`border border-line px-2.5 py-2 text-xs font-bold transition-colors ${
                        amount === val && !error
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
              {t.donateBox.impactText
                .replace("{amount}", amount.toString())
                .replace("{current}", formatUsdc(project.estimatedMatching))
                .replace("{next}", formatUsdc(impact.nextMatching))
                .replace("{diff}", formatUsdc(impact.increase))}
            </p>
          </div>

          {/* Honest copy about 2 sequential confirmations */}
          <p className="text-[11px] text-muted leading-tight">
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
                  {locale === "vi" ? "Số dư USDC không đủ" : "Insufficient USDC Balance"}
                </p>
                <p className="text-muted">
                  {locale === "vi"
                    ? `Ví của bạn hiện có ${usdcBalanceUsdc.toFixed(0)} USDC, không đủ để quyên góp ${amount} USDC.`
                    : `Your wallet currently has ${usdcBalanceUsdc.toFixed(0)} USDC, but ${amount} USDC is required.`}
                </p>
                <Link
                  href="/my"
                  className="inline-flex items-center gap-1 font-bold text-primary underline hover:opacity-80 pt-0.5"
                >
                  {locale === "vi" ? "Nhận 100 USDC từ Faucet tại My Dashboard" : "Claim 100 USDC from Faucet in My Dashboard"} &rarr;
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
                Self-donation not allowed
              </Button>
            ) : !isStudent ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                {hasRequested ? "Waiting for admin approval" : "Verification required"}
              </Button>
            ) : isMaxAllowanceReached ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-50">
                Max 5 USDC limit reached
              </Button>
            ) : hasInsufficientBalance ? (
              <Button variant="secondary" fullWidth disabled className="py-3 text-sm font-bold opacity-60">
                {locale === "vi"
                  ? `Số dư USDC không đủ (${usdcBalanceUsdc.toFixed(0)} USDC)`
                  : `Insufficient USDC Balance (${usdcBalanceUsdc.toFixed(0)} USDC)`}
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
                  ? "Approving USDC (Step 1/2)..."
                  : donationStep === "donating"
                  ? "Confirming Donation (Step 2/2)..."
                  : `Donate ${amount} USDC`}
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
              Matching pool estimate increased by +{formatUsdc(impact.increase)}!
            </p>
          </div>
          {activeTxHash && <TxStatusDisplay status="success" txHash={activeTxHash} />}
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={resetDonate}
          >
            Donate again
          </Button>
        </div>
      )}
    </Frame>
  );
}
