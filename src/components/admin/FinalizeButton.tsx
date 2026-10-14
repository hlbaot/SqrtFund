"use client";

import { useTxFlow } from "@/hooks/useTxFlow";
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function FinalizeButton() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { roundAddress, endTime, finalized, refetch } = useRound();
  const nowSec = useCurrentTimestamp();

  const [showTooltip, setShowTooltip] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const canFinalize = Boolean(roundAddress && !finalized && endTime && nowSec > 0 && BigInt(nowSec) >= endTime);

  const handleFinalize = async () => {
    const flow = beginFlow();
    if (!roundAddress || !publicClient) return;

    const toastId = "finalize-round";
    setIsPending(true);
    try {
      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang chốt round..." : "Finalizing round...",
        locale === "vi" ? "Vui lòng xác nhận trong ví của bạn." : "Please confirm in your wallet."
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "finalize",
      }));

      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang tính toán phân bổ quỹ..." : "Computing quadratic payouts...",
        locale === "vi" ? "Đang chờ xác nhận khối trên blockchain." : "Waiting for blockchain confirmation.",
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("Finalize transaction reverted.");
      }

      flow.toast.success(
        toastId,
        locale === "vi" ? "Chốt round thành công!" : "Round finalized successfully!",
        locale === "vi"
          ? "Đã tính toán phân bổ và mở khoá chi trả cho các dự án được duyệt."
          : "Allocations computed and payouts unlocked for approved projects.",
        hash
      );

      refetch();
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        locale === "vi" ? "Chốt round thất bại" : "Finalize failed",
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsPending(false);
      }
    }
  };

  if (finalized) {
    return (
      <div className="inline-flex items-center gap-1.5 border border-money/30 bg-money/10 px-4 py-2 text-xs font-bold text-money">
        <CheckCircle2 className="h-4 w-4" />
        <span>{t.admin.roundFinalizedBadge}</span>
      </div>
    );
  }

  return (
    <div className="relative inline-flex flex-col items-start gap-1">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Button
          variant={canFinalize ? "primary" : "secondary"}
          disabled={!canFinalize || isPending}
          isLoading={isPending}
          onClick={handleFinalize}
          className="text-xs font-bold"
        >
          {isPending ? "Finalizing on Fuji..." : t.admin.finalizeButton}
        </Button>
      </div>

      <p className="text-[11px] text-muted max-w-xs leading-tight">
        Grace period: Only admin can finalize for the first 24h after end time; afterwards anyone can finalize.
      </p>

      {showTooltip && !canFinalize && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-2 z-20 w-72 border border-line-strong bg-bg p-2.5 text-xs text-muted shadow-lg"
        >
          <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Action locked</span>
          </div>
          <span>
            Finalization is only allowed after the round end time has passed. During the 24-hour grace period, only the admin can trigger it.
          </span>
        </div>
      )}
    </div>
  );
}
