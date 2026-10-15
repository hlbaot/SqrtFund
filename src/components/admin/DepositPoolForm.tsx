"use client";

import { useTxFlow } from "@/hooks/useTxFlow";

import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { mockUsdcAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function DepositPoolForm() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { roundAddress, token, refetch, finalized } = useRound();

  const [amount, setAmount] = useState("100");
  const [isPending, setIsPending] = useState(false);

  const approveId = "deposit-approve";
  const depositId = "deposit-pool";

  const handleSubmit = async (e: React.FormEvent) => {
    const flow = beginFlow();
    e.preventDefault();
    if (!isConnected || !address || !roundAddress || !token || !publicClient) {
      flow.toast.error(
        depositId,
        t.toasts.walletNotReady,
        t.toasts.walletNotReadyDesc
      );
      return;
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      flow.toast.error(
        depositId,
        t.toasts.invalidAmountTitle,
        t.toasts.invalidAmountDesc
      );
      return;
    }

    const amountBigInt = BigInt(Math.round(num * 1_000_000));
    setIsPending(true);

    try {
      // 1. Check allowance
      const allowance = await flow.wait(() => publicClient.readContract({
        address: token,
        abi: mockUsdcAbi,
        functionName: "allowance",
        args: [address, roundAddress],
      }));

      if (allowance < amountBigInt) {
        flow.toast.pending(
          approveId,
          t.toasts.depositApproveStep,
          t.toasts.depositApproveDesc
        );

        let appHash: `0x${string}`;
        try {
          appHash = await flow.wait(() => writeContractAsync({
            address: token,
            abi: mockUsdcAbi,
            functionName: "approve",
            args: [roundAddress, amountBigInt],
          }));
        } catch (err) {
          if (flow.cancelled) return false;
          flow.error(
            approveId,
            err,
            t.toasts.depositApprovalFailed,
            locale
          );
          throw err;
        }

        flow.toast.pending(
          approveId,
          t.toasts.depositConfirmApproval,
          t.toasts.depositConfirmApprovalDesc,
          appHash
        );

        try {
          const appReceipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: appHash }), 120_000);
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
          if (flow.cancelled) return false;
          flow.error(
            approveId,
            err,
            t.toasts.depositApprovalFailed,
            locale
          );
          throw err;
        }
      }

      // 2. Deposit pool
      flow.toast.pending(
        depositId,
        t.toasts.depositStep,
        t.toasts.depositStepDesc
      );

      let depHash: `0x${string}`;
      try {
        depHash = await flow.wait(() => writeContractAsync({
          address: roundAddress,
          abi: qfRoundAbi,
          functionName: "depositPool",
          args: [amountBigInt],
        }));
      } catch (err) {
        if (flow.cancelled) return false;
        flow.error(
          depositId,
          err,
          t.toasts.depositFailed,
          locale
        );
        throw err;
      }

      flow.toast.pending(
        depositId,
        t.toasts.depositConfirm,
        t.toasts.depositConfirmDesc,
        depHash
      );

      try {
        const depReceipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: depHash }), 120_000);
        if (depReceipt.status !== "success") {
          throw new Error("Deposit transaction reverted.");
        }

        flow.toast.success(
          depositId,
          t.toasts.depositSuccess,
          t.toasts.depositSuccessDesc.replace("{amount}", amount),
          depHash
        );
      } catch (err) {
        if (flow.cancelled) return false;
        flow.error(
          depositId,
          err,
          t.toasts.depositFailed,
          locale
        );
        throw err;
      }

      setAmount("");
      refetch();
    } catch (err) {
      if (flow.cancelled) return false;
      flow.error(depositId, err, t.toasts.depositFailed, locale);
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsPending(false);
      }
    }
  };

  return (
    <div className="border border-line bg-surface p-6 space-y-4 max-w-[720px]">
      <h3 className="text-base font-bold text-foreground tracking-tight">
        {t.admin.depositPoolTitle}
      </h3>
      <p className="text-xs text-muted">
        {t.admin.depositPoolDesc}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.admin.depositAmountLabel}
          type="number"
          placeholder="100"
          value={amount}
          disabled={isPending || finalized}
          onChange={(e) => setAmount(e.target.value)}
          suffixElement="USDC"
          required
        />

        <Button
          type="submit"
          variant="accent"
          fullWidth
          disabled={isPending || finalized}
          isLoading={isPending}
          className="text-xs font-bold py-2.5"
        >
          {finalized ? t.admin.roundAlreadyFinalized : isPending ? t.admin.processingOnFuji : t.admin.depositBtn}
        </Button>
      </form>
    </div>
  );
}
