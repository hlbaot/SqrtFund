"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/context/locale";
import { useToast } from "@/lib/context/toast";
import { useRound } from "@/hooks/useRound";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { getContractErrorMessage } from "@/lib/errors";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function FinalizeButton() {
  const { t } = useLocale();
  const { addToast } = useToast();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { roundAddress, endTime, finalized, refetch } = useRound();
  const nowSec = useCurrentTimestamp();

  const [showTooltip, setShowTooltip] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const canFinalize = Boolean(roundAddress && !finalized && endTime && nowSec > 0 && BigInt(nowSec) >= endTime);

  const handleFinalize = async () => {
    if (!roundAddress || !publicClient) return;

    setIsPending(true);
    try {
      addToast({
        type: "pending",
        title: "Finalizing round...",
        description: "Please confirm in your wallet.",
      });

      const hash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "finalize",
      });

      addToast({
        type: "pending",
        title: "Computing quadratic payouts...",
        description: "Waiting for blockchain confirmation.",
        txHash: hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Finalize transaction reverted.");
      }

      addToast({
        type: "success",
        title: "Round finalized successfully!",
        description: "Allocations computed and payouts unlocked for approved projects.",
        txHash: hash,
      });

      refetch();
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Finalize failed",
        description: msg,
      });
    } finally {
      setIsPending(false);
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
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(!canFinalize)}
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

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-64 border border-line-strong bg-bg p-2.5 text-center text-xs text-muted"
        >
          <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-0.5 justify-center">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Action locked</span>
          </div>
          <span>Finalization is allowed only after the round endTime has passed.</span>
        </div>
      )}
    </div>
  );
}
