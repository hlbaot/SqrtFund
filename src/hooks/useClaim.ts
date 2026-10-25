"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useChainId, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { TARGET_CHAIN_ID, usdcAddress } from "@/lib/contracts/addresses";
import { mockUsdcAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { useLocale } from "@/lib/context/locale";
import { useTxFlow } from "@/hooks/useTxFlow";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { calculateRemainingSeconds, calculateCanClaim } from "@/lib/format";
import { QUERY_GC_MS } from "@/lib/queryPolicy";

export function useClaim() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const queryClient = useQueryClient();
  const { address, isConnected, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const { writeContractAsync } = useWriteContract();
  const { roundAddress } = useRound();

  const [isClaimingUsdc, setIsClaimingUsdc] = useState(false);
  const [isPendingMatching, setIsPendingMatching] = useState(false);
  const nowSec = useCurrentTimestamp();

  const [clockSkew, setClockSkew] = useState(0);
  const prevRemainingRef = useRef<number | null>(null);

  const isTargetChain = chainId === TARGET_CHAIN_ID;
  const enabled = Boolean(address && isConnected && usdcAddress && isTargetChain);

  // 1. Fetch on-chain faucet configuration & user claim status
  const {
    data: faucetData,
    isLoading: isReading,
    refetch,
  } = useReadContracts({
    contracts: [
      {
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: "lastFaucetMint",
        args: address ? [address] : undefined,
      },
      {
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: "FAUCET_COOLDOWN",
      },
      {
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: "lifetimeMinted",
        args: address ? [address] : undefined,
      },
      {
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: "FAUCET_AMOUNT",
      },
      {
        address: usdcAddress,
        abi: mockUsdcAbi,
        functionName: "LIFETIME_CAP",
      },
    ],
    query: {
      enabled,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const lastMint = faucetData?.[0]?.result as bigint | undefined;
  const cooldown = faucetData?.[1]?.result as bigint | undefined;
  const lifetimeMinted = faucetData?.[2]?.result as bigint | undefined;
  const amount = faucetData?.[3]?.result as bigint | undefined;
  const cap = faucetData?.[4]?.result as bigint | undefined;

  const cooldownDuration = cooldown !== undefined ? Number(cooldown) : 3600;

  // Calculate nextClaimAt (seconds)
  const nextClaimAt =
    lastMint !== undefined && lastMint > 0n && cooldown !== undefined
      ? Number(lastMint + cooldown)
      : 0;

  // 2. Calibrate clock skew against latest block once
  useEffect(() => {
    let cancelled = false;
    if (!enabled || !publicClient) return;

    // Navbar, wallet menu and /my share the same sample. Guest visitors have no
    // faucet countdown to calibrate, so they do not need this RPC at all.
    queryClient.fetchQuery({
      queryKey: ["chain-clock", TARGET_CHAIN_ID],
      queryFn: async () => {
        const block = await publicClient.getBlock({ blockTag: "latest" });
        return { timestamp: block.timestamp, sampledAt: Math.floor(Date.now() / 1000) };
      },
      staleTime: 30_000,
      gcTime: QUERY_GC_MS,
    }).then((sample) => {
        if (cancelled) return;
        setClockSkew(Number(sample.timestamp) - sample.sampledAt);
      })
      .catch(() => {
        // Fallback to local clock
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, publicClient, queryClient]);

  const currentNowSec = nowSec > 0 ? nowSec + clockSkew : 0;
  const remainingSeconds =
    nowSec > 0 && nextClaimAt > 0
      ? calculateRemainingSeconds(nextClaimAt, currentNowSec)
      : 0;

  // Trigger refetch when countdown reaches 0
  useEffect(() => {
    if (
      prevRemainingRef.current !== null &&
      prevRemainingRef.current > 0 &&
      remainingSeconds === 0 &&
      nowSec > 0
    ) {
      void refetch();
    }
    if (nowSec > 0) {
      prevRemainingRef.current = remainingSeconds;
    }
  }, [remainingSeconds, nowSec, refetch]);

  const hasFaucetData = lastMint !== undefined && cooldown !== undefined &&
    lifetimeMinted !== undefined && amount !== undefined && cap !== undefined;
  const canClaim = enabled && hasFaucetData && nowSec > 0 && !isClaimingUsdc && calculateCanClaim({
    isConnected,
    nextClaimAt,
    remainingSeconds,
    lifetimeMinted,
    amount,
    cap,
  });

  // 4. Claim 100 test USDC from faucet
  const claimUsdc = useCallback(async () => {
    const flow = beginFlow("claim-usdc");
    const toastId = "claim-usdc";
    if (!address || !publicClient || !canClaim) {
      flow.finish();
      return false;
    }

    setIsClaimingUsdc(true);
    try {
      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang nhận 100 USDC test..." : "Claiming 100 test USDC...",
        locale === "vi"
          ? "Vui lòng xác nhận giao dịch trong ví của bạn."
          : "Please confirm the transaction in your wallet."
      );

      const hash = await flow.wait(() =>
        writeContractAsync({
          address: usdcAddress,
          abi: mockUsdcAbi,
          functionName: "faucetMint",
        })
      );

      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang xác nhận nhận USDC..." : "Confirming faucet mint...",
        locale === "vi"
          ? "Đang chờ xác nhận khối trên Avalanche Fuji."
          : "Waiting for block confirmation on Avalanche Fuji.",
        hash
      );

      const receipt = await flow.wait(
        () => publicClient.waitForTransactionReceipt({ hash }),
        120_000
      );

      if (receipt.status !== "success") {
        throw new Error("faucetMint transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.faucet.claimedSuccess,
        locale === "vi"
          ? "100 USDC testnet đã được cộng vào ví của bạn."
          : "100 testnet USDC has been credited to your wallet.",
        hash
      );

      // Instant refresh of cooldown & balance queries
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries(),
      ]);

      return true;
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        locale === "vi" ? "Nhận USDC thất bại" : "Claim failed",
        locale
      );
      // If error might be due to cooldown, trigger a fast refetch to update local state
      void refetch();
      return false;
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsClaimingUsdc(false);
      }
    }
  }, [
    address,
    canClaim,
    publicClient,
    beginFlow,
    locale,
    writeContractAsync,
    t.faucet.claimedSuccess,
    refetch,
    queryClient,
  ]);

  // 5. Claim project matching funds
  const claimMatching = useCallback(
    async (projectId: bigint, targetRound: Address | undefined = roundAddress) => {
      const flow = beginFlow(`claim-${targetRound}-${projectId}`);
      if (!targetRound || !publicClient || !isConnected || !isTargetChain) return false;

      const toastId = `claim-${projectId}`;
      setIsPendingMatching(true);
      try {
        flow.toast.pending(toastId, t.transactions.claiming, t.transactions.signClaim);

        const hash = await flow.wait(() =>
          writeContractAsync({
            address: targetRound,
            chainId: TARGET_CHAIN_ID,
            abi: qfRoundAbi,
            functionName: "claim",
            args: [projectId],
          })
        );

        flow.toast.pending(
          toastId,
          t.transactions.confirmingClaim,
          t.transactions.confirming,
          hash
        );

        const receipt = await flow.wait(
          () => publicClient.waitForTransactionReceipt({ hash }),
          120_000
        );

        if (receipt.status !== "success") {
          throw new Error("Claim transaction reverted.");
        }

        flow.toast.success(
          toastId,
          t.transactions.claimSuccess,
          t.transactions.claimSuccessDescription,
          hash
        );

        await queryClient.invalidateQueries();
        return true;
      } catch (err: unknown) {
        if (flow.cancelled) return false;
        flow.error(toastId, err, t.transactions.claimFailed, locale);
        return false;
      } finally {
        flow.finish();
        if (!flow.cancelled) {
          setIsPendingMatching(false);
        }
      }
    },
    [
      beginFlow,
      isConnected,
      isTargetChain,
      roundAddress,
      publicClient,
      t.transactions,
      writeContractAsync,
      queryClient,
      locale,
    ]
  );

  // Overloaded claim dispatcher
  const claim = useCallback(
    async (projectId?: bigint, targetRound?: Address) => {
      if (typeof projectId === "bigint") {
        return claimMatching(projectId, targetRound);
      }
      return claimUsdc();
    },
    [claimMatching, claimUsdc]
  );

  return {
    canClaim,
    nextClaimAt,
    remainingSeconds,
    cooldownDuration,
    isLoading: enabled && (isReading || nowSec === 0),
    claim,
    claimUsdc,
    claimMatching,
    isClaimingUsdc,
    isClaiming: isClaimingUsdc || isPendingMatching,
    isPending: isPendingMatching,
    claimableUsdc: canClaim ? 1 : 0,
    refetch,
  };
}
