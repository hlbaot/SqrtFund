"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { parseAbiItem, type Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { useRound } from "@/hooks/useRound";
import { useLocale } from "@/lib/context/locale";
import { useTxFlow } from "@/hooks/useTxFlow";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export function useVerificationRequest() {
  const { address, isConnected, chainId } = useAccount();
  const { roundAddress } = useRound();
  const { t, locale } = useLocale();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const beginFlow = useTxFlow();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectedAddress, setRejectedAddress] = useState<string | null>(null);

  const isTargetChain = chainId === TARGET_CHAIN_ID;
  const enabled = Boolean(roundAddress && address && isConnected && isTargetChain);

  const { data, refetch, isLoading: isReading } = useReadContracts({
    contracts: [
      {
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "isWhitelisted",
        args: address ? [address as Address] : undefined,
      },
      {
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "requested",
        args: address ? [address as Address] : undefined,
      },
    ],
    query: {
      enabled,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const isWhitelisted = Boolean(data?.[0]?.result);
  const isRequested = Boolean(data?.[1]?.result);
  const isLocallyRejected = Boolean(
    address &&
      rejectedAddress === address.toLowerCase() &&
      !isWhitelisted &&
      !isRequested
  );

  // Check if wallet was previously rejected
  useEffect(() => {
    let isMounted = true;
    if (!address || !roundAddress || !publicClient || !enabled || isWhitelisted || isRequested) {
      return;
    }

    async function checkRejection() {
      // Check session storage first
      try {
        const stored = window.sessionStorage.getItem(`rejected_${address?.toLowerCase()}`);
        if (stored === "true") {
          if (isMounted) setRejectedAddress(address!.toLowerCase());
          return;
        }
      } catch {
        // Storage access may be restricted
      }

      // Query past WhitelistUpdated logs for this address
      if (!publicClient) return;
      try {
        const logs = await publicClient.getLogs({
          address: roundAddress,
          event: parseAbiItem("event WhitelistUpdated(address indexed account, bool status)"),
          args: { account: address as Address },
          fromBlock: 0n,
        });

        if (logs.length > 0 && isMounted) {
          const lastLog = logs[logs.length - 1];
          const wasRejected = lastLog.args.status === false;
          if (wasRejected) {
            setRejectedAddress(address!.toLowerCase());
            try {
              window.sessionStorage.setItem(`rejected_${address?.toLowerCase()}`, "true");
            } catch {
              // Ignore
            }
          }
        }
      } catch {
        // Event scan is optional
      }
    }

    void checkRejection();

    return () => {
      isMounted = false;
    };
  }, [address, roundAddress, publicClient, enabled, isWhitelisted, isRequested]);

  let status: VerificationStatus = "none";
  if (isWhitelisted) {
    status = "approved";
  } else if (isRequested) {
    status = "pending";
  } else if (isLocallyRejected) {
    status = "rejected";
  }

  const submit = useCallback(async () => {
    if (!address || !roundAddress || !publicClient) return false;

    const toastId = "verify-request";
    const flow = beginFlow("verify-request");
    setIsSubmitting(true);

    try {
      // Check if queue has reached 500 limit
      const requestersData = await publicClient.readContract({
        address: roundAddress,
        abi: qfRoundAbi,
        functionName: "getRequesters",
        args: [0n, 1n],
      });

      const totalQueue = Number(requestersData[1]);
      if (totalQueue >= 500) {
        flow.toast.error(
          toastId,
          t.verification.queueFull,
          locale === "vi"
            ? "Hàng đợi xác thực sinh viên đã đạt tối đa 500 người. Vui lòng thử lại sau."
            : "Student verification queue is full (max 500). Please try again later."
        );
        return false;
      }

      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang gửi yêu cầu xác nhận..." : "Requesting verification...",
        locale === "vi"
          ? "Vui lòng xác nhận giao dịch trong ví của bạn."
          : "Please confirm the transaction in your wallet."
      );

      const hash = await flow.wait(() =>
        writeContractAsync({
          address: roundAddress,
          abi: qfRoundAbi,
          functionName: "requestVerification",
        })
      );

      flow.toast.pending(
        toastId,
        locale === "vi" ? "Đang xác nhận yêu cầu..." : "Confirming request...",
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
        throw new Error("Verification request transaction reverted.");
      }

      // Reset rejected flag if any
      try {
        window.sessionStorage.removeItem(`rejected_${address.toLowerCase()}`);
      } catch {
        // Ignore
      }
      setRejectedAddress(null);

      flow.toast.success(
        toastId,
        t.verification.requestSent,
        locale === "vi"
          ? "Địa chỉ ví đã được thêm vào hàng chờ duyệt của Admin."
          : "Your wallet address is now pending admin approval.",
        hash
      );

      await refetch();
      return true;
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        locale === "vi" ? "Gửi yêu cầu thất bại" : "Verification request failed",
        locale
      );
      return false;
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsSubmitting(false);
      }
    }
  }, [address, roundAddress, publicClient, beginFlow, t, locale, writeContractAsync, refetch]);

  return {
    status,
    isSubmitting,
    isLoading: isReading,
    submit,
    refetch,
  };
}
