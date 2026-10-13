"use client";

import React, { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { mockUsdcAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { useToast } from "@/lib/context/toast";
import { useRound } from "@/hooks/useRound";
import { getContractErrorMessage } from "@/lib/errors";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function DepositPoolForm() {
  const { t } = useLocale();
  const { address, isConnected } = useAccount();
  const { addToast } = useToast();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { roundAddress, token, refetch, finalized } = useRound();

  const [amount, setAmount] = useState("1000");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address || !roundAddress || !token || !publicClient) {
      addToast({
        type: "error",
        title: "Wallet not ready",
        description: "Please connect the admin wallet.",
      });
      return;
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      addToast({ type: "error", title: "Invalid amount", description: "Please enter a valid amount." });
      return;
    }

    const amountBigInt = BigInt(Math.round(num * 1_000_000));
    setIsPending(true);

    try {
      // 1. Check allowance
      const allowance = await publicClient.readContract({
        address: token,
        abi: mockUsdcAbi,
        functionName: "allowance",
        args: [address, roundAddress],
      });

      if (allowance < amountBigInt) {
        addToast({
          type: "pending",
          title: "Step 1/2: Approving USDC...",
          description: "Please confirm token allowance in your wallet.",
        });

        const appHash = await writeContractAsync({
          address: token,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [roundAddress, amountBigInt],
        });

        addToast({
          type: "pending",
          title: "Confirming approval...",
          txHash: appHash,
        });

        await publicClient.waitForTransactionReceipt({ hash: appHash });
      }

      // 2. Deposit pool
      addToast({
        type: "pending",
        title: "Step 2/2: Depositing pool...",
        description: "Please confirm pool deposit transaction.",
      });

      const depHash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "depositPool",
        args: [amountBigInt],
      });

      addToast({
        type: "pending",
        title: "Confirming pool deposit...",
        txHash: depHash,
      });

      await publicClient.waitForTransactionReceipt({ hash: depHash });

      addToast({
        type: "success",
        title: "Pool deposit confirmed!",
        description: `Successfully added ${amount} USDC to the sponsor matching pool.`,
        txHash: depHash,
      });

      setAmount("");
      refetch();
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Deposit failed",
        description: msg,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="border border-line bg-surface p-6 space-y-4">
      <h3 className="text-base font-bold text-foreground tracking-tight">
        {t.admin.depositPoolTitle}
      </h3>
      <p className="text-xs text-muted">
        Deposit sponsor matching funds into the Fuji round contract before finalization.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.admin.depositAmountLabel}
          type="number"
          placeholder="1000"
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
          {finalized ? "Round already finalized" : isPending ? "Processing on Fuji..." : t.admin.depositBtn}
        </Button>
      </form>
    </div>
  );
}
