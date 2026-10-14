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

  const [amount, setAmount] = useState("1000");
  const [isPending, setIsPending] = useState(false);

  const approveId = "deposit-approve";
  const depositId = "deposit-pool";

  const handleSubmit = async (e: React.FormEvent) => {
    const flow = beginFlow();
    e.preventDefault();
    if (!isConnected || !address || !roundAddress || !token || !publicClient) {
      flow.toast.error(
        depositId,
        locale === "vi" ? "Ví chưa sẵn sàng" : "Wallet not ready",
        locale === "vi" ? "Vui lòng kết nối ví admin." : "Please connect the admin wallet."
      );
      return;
    }

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      flow.toast.error(
        depositId,
        locale === "vi" ? "Số lượng không hợp lệ" : "Invalid amount",
        locale === "vi" ? "Vui lòng nhập số lượng hợp lệ." : "Please enter a valid amount."
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
          locale === "vi" ? "Bước 1/2: Đang phê duyệt USDC..." : "Step 1/2: Approving USDC...",
          locale === "vi"
            ? "Vui lòng xác nhận phê duyệt token trong ví."
            : "Please confirm token allowance in your wallet."
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
            locale === "vi" ? "Phê duyệt thất bại" : "Approval failed",
            locale
          );
          throw err;
        }

        flow.toast.pending(
          approveId,
          locale === "vi" ? "Bước 1/2: Đang xác nhận phê duyệt..." : "Step 1/2: Confirming approval...",
          locale === "vi"
            ? "Đang chờ xác nhận khối trên Avalanche Fuji."
            : "Waiting for block confirmation on Avalanche Fuji.",
          appHash
        );

        try {
          const appReceipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: appHash }), 120_000);
          if (appReceipt.status !== "success") {
            throw new Error("Approval transaction reverted.");
          }
          flow.toast.success(
            approveId,
            locale === "vi" ? "Bước 1/2: Đã phê duyệt USDC" : "Step 1/2: USDC Approved",
            locale === "vi" ? "Đã cấp quyền chi tiêu token thành công." : "Token allowance confirmed.",
            appHash
          );
        } catch (err) {
          if (flow.cancelled) return false;
          flow.error(
            approveId,
            err,
            locale === "vi" ? "Phê duyệt thất bại" : "Approval confirmation failed",
            locale
          );
          throw err;
        }
      }

      // 2. Deposit pool
      flow.toast.pending(
        depositId,
        locale === "vi" ? "Bước 2/2: Đang nạp vào pool..." : "Step 2/2: Depositing pool...",
        locale === "vi" ? "Vui lòng xác nhận giao dịch nạp pool." : "Please confirm pool deposit transaction."
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
          locale === "vi" ? "Nạp pool thất bại" : "Deposit failed",
          locale
        );
        throw err;
      }

      flow.toast.pending(
        depositId,
        locale === "vi" ? "Bước 2/2: Đang xác nhận nạp pool..." : "Step 2/2: Confirming pool deposit...",
        locale === "vi"
          ? "Đang chờ xác nhận khối trên Avalanche Fuji."
          : "Waiting for block confirmation on Avalanche Fuji.",
        depHash
      );

      try {
        const depReceipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: depHash }), 120_000);
        if (depReceipt.status !== "success") {
          throw new Error("Deposit transaction reverted.");
        }

        flow.toast.success(
          depositId,
          locale === "vi" ? "Đã nạp pool thành công!" : "Pool deposit confirmed!",
          locale === "vi"
            ? `Đã thêm thành công ${amount} USDC vào quỹ đối ứng.`
            : `Successfully added ${amount} USDC to the sponsor matching pool.`,
          depHash
        );
      } catch (err) {
        if (flow.cancelled) return false;
        flow.error(
          depositId,
          err,
          locale === "vi" ? "Xác nhận nạp pool thất bại" : "Deposit confirmation failed",
          locale
        );
        throw err;
      }

      setAmount("");
      refetch();
    } catch (err) {
      if (flow.cancelled) return false;
      flow.error(depositId, err, locale === "vi" ? "Nạp pool thất bại" : "Deposit failed", locale);
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
