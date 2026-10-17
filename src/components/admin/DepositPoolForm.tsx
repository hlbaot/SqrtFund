"use client";

import { useTxFlow } from "@/hooks/useTxFlow";
import React, { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { mockUsdcAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useRole } from "@/hooks/useRole";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { parseUsdc, formatUsdc, shortAddress } from "@/lib/format";
import { fmt } from "@/lib/copy";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Coins } from "lucide-react";

export function DepositPoolForm() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { address, isConnected, chainId } = useAccount();
  const { role, isReady } = useRole();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const { roundAddress, name: roundName, token, refetch, finalized, isCancelled, pool } = useRound();

  const [amount, setAmount] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const approveId = "deposit-approve";
  const depositId = "deposit-pool";

  // Read admin's USDC balance on-chain from round's token contract
  const { data: adminBalanceData, refetch: refetchAdminBalance } = useReadContract({
    address: token,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(token && address),
      refetchInterval: 5000,
    },
  });

  const adminBalance = (adminBalanceData as bigint | undefined) ?? 0n;

  // Validation using BigInt parsing without Number conversions
  const validation = parseUsdc(amount, adminBalance);

  const isFuji = chainId === TARGET_CHAIN_ID;
  const isAdmin = isReady && role === "admin";
  const hasNoBalance = adminBalance === 0n;

  // Determine disabled reason and state
  let disabledExplanation: string | null = null;
  let isButtonDisabled = isPending;

  if (isCancelled) return null;
  if (finalized) {
    isButtonDisabled = true;
    disabledExplanation = t.admin.disabledFinalizedExplanation;
  } else if (!isConnected || !isAdmin) {
    isButtonDisabled = true;
    disabledExplanation = t.admin.disabledNotAdminExplanation;
  } else if (!isFuji) {
    isButtonDisabled = true;
    disabledExplanation = t.admin.disabledWrongNetworkExplanation;
  } else if (hasNoBalance) {
    isButtonDisabled = true;
    disabledExplanation = t.admin.disabledNoBalanceExplanation;
  } else if (!validation.success) {
    isButtonDisabled = true;
  }

  let validationErrorMessage: string | null = null;
  if (amount.trim() !== "" && !validation.success) {
    switch (validation.errorKey) {
      case "empty":
        validationErrorMessage = t.admin.validationEmptyAmount;
        break;
      case "negative":
        validationErrorMessage = t.admin.validationNegativeAmount;
        break;
      case "zero":
        validationErrorMessage = t.admin.validationZeroAmount;
        break;
      case "too_many_decimals":
        validationErrorMessage = t.admin.validationTooManyDecimals;
        break;
      case "exceeds_balance":
        validationErrorMessage = t.admin.validationExceedsBalance;
        break;
      case "invalid_format":
      default:
        validationErrorMessage = t.admin.validationInvalidAmount;
        break;
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.success || isButtonDisabled) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmedDeposit = async () => {
    if (!validation.success || !address || !roundAddress || !token || !publicClient) return;
    const amountBigInt = validation.amount;

    setIsConfirmOpen(false);
    const flow = beginFlow("deposit-matching-pool");
    setIsPending(true);

    try {
      // 1. Check current allowance
      const allowance = await flow.wait(() =>
        publicClient.readContract({
          address: token,
          abi: mockUsdcAbi,
          functionName: "allowance",
          args: [address, roundAddress],
        })
      );

      // If allowance is lower than amount, approve exactly the amount
      if (allowance < amountBigInt) {
        flow.toast.pending(
          approveId,
          t.toasts.depositApproveStep,
          t.toasts.depositApproveDesc
        );

        let appHash: `0x${string}`;
        try {
          appHash = await flow.wait(() =>
            writeContractAsync({
              address: token,
              abi: mockUsdcAbi,
              functionName: "approve",
              args: [roundAddress, amountBigInt],
            })
          );
        } catch (err) {
          if (flow.cancelled) return;
          flow.error(approveId, err, t.toasts.depositApprovalFailed, locale);
          throw err;
        }

        flow.toast.pending(
          approveId,
          t.toasts.depositConfirmApproval,
          t.toasts.depositConfirmApprovalDesc,
          appHash
        );

        try {
          const appReceipt = await flow.wait(
            () => publicClient.waitForTransactionReceipt({ hash: appHash }),
            120_000
          );
          if (appReceipt.status !== "success") {
            throw new Error("Approval transaction reverted.");
          }
          flow.toast.success(
            approveId,
            t.toasts.depositApproved,
            t.toasts.depositApprovedDesc,
            appHash
          );
        } catch (err) {
          if (flow.cancelled) return;
          flow.error(approveId, err, t.toasts.depositApprovalFailed, locale);
          throw err;
        }
      }

      // 2. Call depositPool(amount)
      flow.toast.pending(
        depositId,
        t.toasts.depositStep,
        t.toasts.depositStepDesc
      );

      let depHash: `0x${string}`;
      try {
        depHash = await flow.wait(() =>
          writeContractAsync({
            address: roundAddress,
            abi: qfRoundAbi,
            functionName: "depositPool",
            args: [amountBigInt],
          })
        );
      } catch (err) {
        if (flow.cancelled) return;
        flow.error(depositId, err, t.toasts.depositFailed, locale);
        throw err;
      }

      flow.toast.pending(
        depositId,
        t.toasts.depositConfirm,
        t.toasts.depositConfirmDesc,
        depHash
      );

      try {
        const depReceipt = await flow.wait(
          () => publicClient.waitForTransactionReceipt({ hash: depHash }),
          120_000
        );
        if (depReceipt.status !== "success") {
          throw new Error("Deposit transaction reverted.");
        }

        flow.toast.success(
          depositId,
          t.toasts.depositSuccess,
          t.toasts.depositSuccessDesc.replace(
            "{amount}",
            formatUsdc(amountBigInt, { includeSymbol: false })
          ),
          depHash
        );
      } catch (err) {
        if (flow.cancelled) return;
        flow.error(depositId, err, t.toasts.depositFailed, locale);
        throw err;
      }

      setAmount("");
      refetch();
      refetchAdminBalance();
      await queryClient.invalidateQueries();
    } catch (err) {
      if (flow.cancelled) return;
      flow.error(depositId, err, t.toasts.depositFailed, locale);
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsPending(false);
      }
    }
  };

  const quickChips = [
    { label: "100", value: "100" },
    { label: "1,000", value: "1000" },
    { label: "10,000", value: "10000" },
  ];

  const isLargeAmount = validation.success && validation.amount >= 10_000_000_000n; // >= 10,000 USDC

  return (
    <div className="border border-line bg-surface p-6 space-y-4 max-w-[720px]">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground tracking-tight">
          {t.admin.depositPoolTitle}
        </h3>
      </div>
      <p className="text-xs text-muted">
        {t.admin.depositPoolDesc}
      </p>

      {/* Current Matching Pool Indicator (Top-up deposits supported) */}
      <div className="flex items-center justify-between border border-line/70 bg-surface-2 p-3 text-xs">
        <span className="text-muted flex items-center gap-1.5 role-label">
          <Coins className="h-4 w-4 text-money shrink-0" />
          <span>{fmt(t.admin.currentPoolLabel, { amount: "" }).replace(/:\s*USDC$/, "").replace(/:\s*$/, "")}:</span>
        </span>
        <span
          className="role-value-md text-money truncate ml-2"
          title={formatUsdc(pool)}
        >
          {formatUsdc(pool)}
        </span>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Admin USDC balance & Max button */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted font-mono truncate" title={formatUsdc(adminBalance)}>
              {fmt(t.admin.adminBalanceLabel, {
                balance: formatUsdc(adminBalance, { includeSymbol: false }),
              })}
            </span>
            <button
              type="button"
              onClick={() => {
                if (adminBalance > 0n) {
                  setAmount(formatUnits(adminBalance, 6));
                }
              }}
              disabled={isPending || finalized || adminBalance === 0n}
              className="mono-label text-xs font-bold text-primary hover:underline disabled:text-muted disabled:no-underline"
            >
              {t.admin.maxBtn}
            </button>
          </div>

          <Input
            label={t.admin.depositAmountLabel}
            type="text"
            inputMode="decimal"
            placeholder="100"
            value={amount}
            disabled={isPending || finalized}
            onChange={(e) => setAmount(e.target.value)}
            suffixElement="USDC"
            error={validationErrorMessage ?? undefined}
            required
          />

          {/* Quick chips (fill input only) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted">Quick amounts:</span>
            {quickChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setAmount(chip.value)}
                disabled={isPending || finalized}
                className="rounded-xs border border-line bg-surface-2 px-2.5 py-1 text-xs font-mono font-semibold text-foreground hover:bg-surface hover:border-line-strong transition-colors disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Button
            type="submit"
            variant="accent"
            fullWidth
            disabled={isButtonDisabled}
            isLoading={isPending}
            className="text-xs font-bold py-2.5"
          >
            {finalized
              ? t.admin.roundAlreadyFinalized
              : isPending
              ? t.admin.processingOnFuji
              : t.admin.depositBtn}
          </Button>

          {/* Explanation line for disabled states */}
          {disabledExplanation && (
            <p className="text-xs text-muted text-center italic">
              {disabledExplanation}
            </p>
          )}
        </div>
      </form>

      {/* Confirmation Dialog */}
      <Dialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={t.admin.confirmDepositTitle}
        description={t.admin.confirmDepositNotice}
      >
        <div className="space-y-4 pt-3 text-xs">
          <div className="border border-line bg-surface-2 p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted role-label">{t.admin.confirmDepositAmount}:</span>
              <span className="role-value-md text-money">
                {validation.success ? formatUsdc(validation.amount) : `${amount} USDC`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted role-label">{t.admin.confirmDepositRound}:</span>
              <span className="font-mono text-foreground font-semibold truncate max-w-[200px]" title={roundName || roundAddress}>
                {roundName || (roundAddress ? shortAddress(roundAddress) : "Active Round")}
              </span>
            </div>
          </div>

          {/* Prominent warning for deposits >= 10,000 USDC */}
          {isLargeAmount && (
            <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 p-3 text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-1 leading-relaxed">
                <span className="font-bold block role-label">
                  {t.admin.warningLargeDepositTitle}
                </span>
                <span>{t.admin.warningLargeAmountZeros}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isPending}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={handleConfirmedDeposit}
              isLoading={isPending}
              disabled={isPending}
              className="font-bold gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              {t.common.confirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
