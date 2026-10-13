"use client";

import { useState } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useToast } from "@/lib/context/toast";
import { getContractErrorMessage } from "@/lib/errors";
import { useRound } from "@/hooks/useRound";

export function useClaim() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { addToast } = useToast();
  const { roundAddress } = useRound();
  const [isPending, setIsPending] = useState(false);

  const claim = async (projectId: bigint) => {
    if (!roundAddress || !publicClient) return false;

    setIsPending(true);
    try {
      addToast({
        type: "pending",
        title: "Claiming funds...",
        description: "Please confirm the claim transaction in your wallet.",
      });

      const hash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "claim",
        args: [projectId],
      });

      addToast({
        type: "pending",
        title: "Confirming claim...",
        description: "Waiting for blockchain confirmation.",
        txHash: hash,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error("Claim transaction reverted.");
      }

      addToast({
        type: "success",
        title: "Claim successful!",
        description: "Donations and matching funds have been transferred to your wallet.",
        txHash: hash,
      });

      return true;
    } catch (err: unknown) {
      const msg = getContractErrorMessage(err);
      addToast({
        type: "error",
        title: "Claim failed",
        description: msg,
      });
      return false;
    } finally {
      setIsPending(false);
    }
  };

  return { claim, isPending };
}
