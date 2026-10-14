"use client";

import { useTxFlow } from "@/hooks/useTxFlow";

import { useState } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { mockUsdcAbi, qfRoundAbi } from "@/lib/contracts/abis";
import { useLocale } from "@/lib/context/locale";
import { getContractErrorMessage } from "@/lib/errors";
import { useRound } from "@/hooks/useRound";

export type DonationStep = "idle" | "approving" | "donating" | "success" | "error";

export function useDonate() {
  const beginFlow = useTxFlow();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { locale } = useLocale();
  const { roundAddress, token } = useRound();

  const [step, setStep] = useState<DonationStep>("idle");
  const [activeTxHash, setActiveTxHash] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const approveId = "donate-approve";
  const donateId = "donate-confirm";

  const donate = async (projectId: bigint, amount: bigint) => {
    const flow = beginFlow();
    if (!address || !roundAddress || !token || !publicClient) {
      flow.toast.error(
        donateId,
        locale === "vi" ? "Chưa kết nối ví" : "Wallet not connected",
        locale === "vi"
          ? "Vui lòng kết nối ví trước khi thực hiện quyên góp."
          : "Please connect your wallet first."
      );
      return false;
    }

    setErrorMessage(null);

    try {
      // 1. Check user's USDC balance first to prevent gas estimation reverts
      const userBalance = await flow.wait(() => publicClient.readContract({
        address: token,
        abi: mockUsdcAbi,
        functionName: "balanceOf",
        args: [address],
      }));

      if (userBalance < amount) {
        const balFormatted = (Number(userBalance) / 1_000_000).toFixed(0);
        const reqFormatted = (Number(amount) / 1_000_000).toFixed(0);
        const errorMsg =
          locale === "vi"
            ? `Số dư USDC không đủ. Ví của bạn hiện có ${balFormatted} USDC nhưng cần ${reqFormatted} USDC để quyên góp. Vui lòng nhận 100 USDC từ Faucet tại trang 'My Dashboard'.`
            : `Insufficient USDC balance. Your wallet has ${balFormatted} USDC but ${reqFormatted} USDC is required. Please claim 100 USDC from the Faucet in 'My Dashboard'.`;
        setErrorMessage(errorMsg);
        flow.toast.error(
          donateId,
          locale === "vi" ? "Số dư USDC không đủ" : "Insufficient USDC balance",
          errorMsg
        );
        return false;
      }

      // 2. Check existing allowance
      const currentAllowance = await flow.wait(() => publicClient.readContract({
        address: token,
        abi: mockUsdcAbi,
        functionName: "allowance",
        args: [address, roundAddress],
      }));

      // 2. If allowance is less than amount, approve first
      if (currentAllowance < amount) {
        setStep("approving");
        flow.toast.pending(
          approveId,
          locale === "vi" ? "Bước 1/2: Phê duyệt USDC" : "Step 1/2: Approve USDC",
          locale === "vi"
            ? "Vui lòng xác nhận phê duyệt trong ví của bạn."
            : "Please confirm the approval in your wallet (your wallet will prompt twice)."
        );

        let approveHash: `0x${string}`;
        try {
          approveHash = await flow.wait(() => writeContractAsync({
            address: token,
            abi: mockUsdcAbi,
            functionName: "approve",
            args: [roundAddress, amount],
          }));
        } catch (err) {
          if (flow.cancelled) return false;
          setStep("error");
          const msg = getContractErrorMessage(err, locale);
          setErrorMessage(msg);
          flow.error(
            approveId,
            err,
            locale === "vi" ? "Phê duyệt thất bại" : "Approval failed",
            locale
          );
          flow.toast.dismiss(donateId);
          return false;
        }

        setActiveTxHash(approveHash);
        flow.toast.pending(
          approveId,
          locale === "vi" ? "Bước 1/2: Đang xác nhận phê duyệt..." : "Confirming USDC approval...",
          locale === "vi"
            ? "Đang chờ giao dịch được ghi nhận trên Avalanche Fuji."
            : "Waiting for transaction to be mined on Avalanche Fuji.",
          approveHash
        );

        try {
          const approveReceipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: approveHash }), 120_000);

          if (approveReceipt.status !== "success") {
            throw new Error("Approval transaction reverted.");
          }

          flow.toast.success(
            approveId,
            locale === "vi" ? "Bước 1/2: Phê duyệt thành công" : "Step 1/2: USDC Approved",
            locale === "vi" ? "Đã phê duyệt token thành công." : "Token approval confirmed.",
            approveHash
          );
        } catch (err) {
          if (flow.cancelled) return false;
          setStep("error");
          const msg = getContractErrorMessage(err, locale);
          setErrorMessage(msg);
          flow.error(
            approveId,
            err,
            locale === "vi" ? "Xác nhận phê duyệt thất bại" : "Approval confirmation failed",
            locale
          );
          flow.toast.dismiss(donateId);
          return false;
        }
      }

      // 3. Send donate transaction
      setStep("donating");
      flow.toast.pending(
        donateId,
        locale === "vi" ? "Bước 2/2: Xác nhận quyên góp" : "Step 2/2: Confirm Donation",
        locale === "vi"
          ? "Vui lòng xác nhận giao dịch quyên góp trong ví của bạn."
          : "Please confirm the donation transaction in your wallet."
      );

      let donateHash: `0x${string}`;
      try {
        donateHash = await flow.wait(() => writeContractAsync({
          address: roundAddress,
          abi: qfRoundAbi,
          functionName: "donate",
          args: [projectId, amount],
        }));
      } catch (err) {
        if (flow.cancelled) return false;
        setStep("error");
        const msg = getContractErrorMessage(err, locale);
        setErrorMessage(msg);
        flow.error(
          donateId,
          err,
          locale === "vi" ? "Quyên góp thất bại" : "Donation failed",
          locale
        );
        return false;
      }

      setActiveTxHash(donateHash);
      flow.toast.pending(
        donateId,
        locale === "vi" ? "Bước 2/2: Đang xác nhận quyên góp..." : "Confirming donation...",
        locale === "vi"
          ? "Đang ghi nhận quyên góp bậc hai trên blockchain."
          : "Recording your quadratic donation on chain.",
        donateHash
      );

      try {
        const donateReceipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: donateHash }), 120_000);

        if (donateReceipt.status !== "success") {
          throw new Error("Donation transaction reverted.");
        }

        setStep("success");
        flow.toast.success(
          donateId,
          locale === "vi" ? "Quyên góp thành công!" : "Donation successful!",
          locale === "vi"
            ? "Đóng góp bậc hai của bạn đã được xác nhận trên Avalanche Fuji."
            : "Your quadratic donation has been confirmed on Avalanche Fuji.",
          donateHash
        );

        return true;
      } catch (err) {
        if (flow.cancelled) return false;
        setStep("error");
        const msg = getContractErrorMessage(err, locale);
        setErrorMessage(msg);
        flow.error(
          donateId,
          err,
          locale === "vi" ? "Xác nhận quyên góp thất bại" : "Donation confirmation failed",
          locale
        );
        return false;
      }
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      setStep("error");
      const message = getContractErrorMessage(err, locale);
      setErrorMessage(message);
      flow.error(
        donateId,
        err,
        locale === "vi" ? "Quyên góp thất bại" : "Donation failed",
        locale
      );
      return false;
    } finally {
      flow.finish();
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
