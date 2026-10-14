"use client";

import { useLocale } from "@/lib/context/locale";
import { useTxFlow } from "@/hooks/useTxFlow";

import { useState } from "react";
import { useWriteContract, usePublicClient, useAccount, useChainId, useReadContracts } from "wagmi";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { TARGET_CHAIN_ID, usdcAddress } from "@/lib/contracts/addresses";
import { qfRoundAbi, mockUsdcAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";

export function useClaim() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const publicClient = usePublicClient();
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const now = useCurrentTimestamp();
  const { data: faucet } = useReadContracts({
    contracts: [
      { address: usdcAddress, abi: mockUsdcAbi, functionName: "lastFaucetMint", args: address ? [address] : undefined },
      { address: usdcAddress, abi: mockUsdcAbi, functionName: "lifetimeMinted", args: address ? [address] : undefined },
      { address: usdcAddress, abi: mockUsdcAbi, functionName: "FAUCET_AMOUNT" },
      { address: usdcAddress, abi: mockUsdcAbi, functionName: "FAUCET_COOLDOWN" },
      { address: usdcAddress, abi: mockUsdcAbi, functionName: "LIFETIME_CAP" },
    ],
    query: { enabled: Boolean(address && isConnected && usdcAddress && chainId === TARGET_CHAIN_ID), refetchInterval: 30_000 },
  });
  const values = faucet?.map(item => item.status === "success" ? item.result as bigint : undefined);
  const [lastMint, minted, amount, cooldown, cap] = values ?? [];
  const claimableUsdc = lastMint !== undefined && minted !== undefined && amount !== undefined && cooldown !== undefined && cap !== undefined && now > 0 &&
    (lastMint === 0n || BigInt(now) >= lastMint + cooldown) && minted + amount <= cap ? Number(amount) / 1_000_000 : 0;
  const { writeContractAsync } = useWriteContract();
  const { roundAddress } = useRound();
  const [isPending, setIsPending] = useState(false);

  const claim = async (projectId: bigint) => {
    const flow = beginFlow();
    if (!roundAddress || !publicClient) return false;

    const toastId = `claim-${projectId}`;
    setIsPending(true);
    try {
      flow.toast.pending(
        toastId,
        t.transactions.claiming,
        t.transactions.signClaim
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "claim",
        args: [projectId],
      }));

      flow.toast.pending(
        toastId,
        t.transactions.confirmingClaim,
        t.transactions.confirming,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);

      if (receipt.status !== "success") {
        throw new Error("Claim transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.transactions.claimSuccess,
        t.transactions.claimSuccessDescription,
        hash
      );

      return true;
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(toastId, err, t.transactions.claimFailed, locale);
      return false;
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsPending(false);
      }
    }
  };

  return { claim, isPending, claimableUsdc };
}
