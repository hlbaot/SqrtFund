"use client";

import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { mockUsdcAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { useToast } from "@/lib/context/toast";
import { getContractErrorMessage } from "@/lib/errors";
import { useRound } from "@/hooks/useRound";

export type DonationStep = "idle" | "approving" | "donating" | "success" | "error";

export function useDonate() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { addToast } = useToast();
  const { roundAddress, token } = useRound();

  const [step, setStep] = useState<DonationStep>("idle");
  const [activeTxHash, setActiveTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const donate = async (projectId: bigint, amount: bigint) => {
    if (!address || !roundAddress || !token || !publicClient) {
      addToast({
        type: "error",
        title: "Wallet not connected",
        description: "Please connect your wallet first.",
      });
      return false;
    }

    setErrorMessage(null);

    try {
      // 1. Check existing allowance
      const currentAllowance = await publicClient.readContract({
        address: token,
        abi: mockUsdcAbi,
        functionName: "allowance",
        args: [address, roundAddress],
      });

      // 2. If allowance is less than amount, approve first
      if (currentAllowance < amount) {
        setStep("approving");
        addToast({
          type: "pending",
          title: "Step 1/2: Approve USDC",
          description: "Please confirm the approval in your wallet (your wallet will prompt twice).",
        });

        const approveHash = await writeContractAsync({
          address: token,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [roundAddress, amount],
        });

        setActiveTxHash(approveHash);
        addToast({
          type: "pending",
          title: "Confirming USDC approval...",
          description: "Waiting for transaction to be mined on Avalanche Fuji.",
          txHash: approveHash,
        });

        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveHash,
        });

        if (approveReceipt.status !== "success") {
          throw new Error("Approval transaction reverted.");
        }
      }

      // 3. Send donate transaction
      setStep("donating");
      addToast({
        type: "pending",
        title: "Step 2/2: Confirm Donation",
        description: "Please confirm the donation transaction in your wallet.",
      });

      const donateHash = await writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "donate",
        args: [projectId, amount],
      });

      setActiveTxHash(donateHash);
      addToast({
        type: "pending",
        title: "Confirming donation...",
        description: "Recording your quadratic donation on chain.",
        txHash: donateHash,
      });

      const donateReceipt = await publicClient.waitForTransactionReceipt({
        hash: donateHash,
      });

      if (donateReceipt.status !== "success") {
        throw new Error("Donation transaction reverted.");
      }

      setStep("success");
      addToast({
        type: "success",
        title: "Donation successful!",
        description: "Your quadratic donation has been confirmed on Avalanche Fuji.",
        txHash: donateHash,
      });

      return true;
    } catch (err: unknown) {
      setStep("error");
      const message = getContractErrorMessage(err);
      setErrorMessage(message);
      addToast({
        type: "error",
        title: "Donation failed",
        description: message,
      });
      return false;
    }
  };

  const reset = () => {
    setStep("idle");
    setActiveTxHash(undefined);
    setErrorMessage(null);
  };

  return {
    donate,
    reset,
    step,
    isPending: step === "approving" || step === "donating",
    activeTxHash,
    errorMessage,
  };
}
