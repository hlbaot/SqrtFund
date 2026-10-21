"use client";

import { useTokenBalance } from "@/hooks/useTokenBalance";
import { useTxFlow } from "@/hooks/useTxFlow";
import React, { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { isAddress, type Address } from "viem";
import { mockUsdcAbi } from "@/lib/contracts/abis";
import { usdcAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { parseUsdc, formatUsdc } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Check } from "lucide-react";

export function MintTestUsdcForm() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState<string>("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Derived effective recipient
  const effectiveRecipient = recipient || address || "";

  const recipientBalance = useTokenBalance(isAddress(effectiveRecipient.trim()) ? effectiveRecipient.trim() as Address : undefined);

  // Read owner of MockUSDC contract
  const { data: tokenOwnerData } = useReadContract({
    address: usdcAddress,
    chainId: TARGET_CHAIN_ID,
    abi: mockUsdcAbi,
    functionName: "owner",
    query: {
      enabled: Boolean(usdcAddress),
    },
  });

  const tokenOwner = tokenOwnerData as Address | undefined;
  const isTokenOwner = Boolean(
    isConnected &&
    address &&
    tokenOwner &&
    address.toLowerCase() === tokenOwner.toLowerCase()
  );

  // BigInt parsing and validation without Number conversions
  const validation = parseUsdc(amount);
  const isFuji = chainId === TARGET_CHAIN_ID;

  if (!isTokenOwner) {
    return null;
  }

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setRecipientError(null);

    const targetRecipient = effectiveRecipient.trim();
    if (!targetRecipient || !isAddress(targetRecipient)) {
      setRecipientError("Please enter a valid 0x recipient address.");
      return;
    }

    if (!validation.success) {
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleConfirmMint = async () => {
    if (!validation.success || !publicClient || !address) return;
    const targetRecipient = effectiveRecipient.trim() as Address;
    if (!isAddress(targetRecipient)) return;

    setIsConfirmOpen(false);
    const flow = beginFlow("mint-usdc");
    const toastId = "mint-test-usdc";
    setIsPending(true);

    try {
      flow.toast.pending(
        toastId,
        t.toasts.mintingTitle,
        t.toasts.confirmInWallet
      );

      const hash = await flow.wait(() =>
        writeContractAsync({
          address: usdcAddress,
          abi: mockUsdcAbi,
          functionName: "mint",
          args: [targetRecipient, validation.amount],
        })
      );

      flow.toast.pending(
        toastId,
        t.toasts.mintConfirmTitle,
        t.toasts.deployingRoundDesc,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("Mint transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.toasts.mintSuccess,
        t.toasts.mintSuccessDesc
          .replace("{amount}", formatUsdc(validation.amount, { includeSymbol: false }))
          .replace("{recipient}", targetRecipient),
        hash
      );

      setAmount("");
      await queryClient.invalidateQueries();
    } catch (err: unknown) {
      if (flow.cancelled) return;
      flow.error(toastId, err, t.toasts.mintFailed, locale);
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsPending(false);
      }
    }
  };

  const quickChips = [
    { label: "1,000", value: "1000" },
    { label: "10,000", value: "10000" },
    { label: "100,000", value: "100000" },
  ];

  let validationErrorMessage: string | null = null;
  if (amount.trim() !== "" && !validation.success) {
    switch (validation.errorKey) {
      case "empty":
        validationErrorMessage = t.admin.validationEmptyAmount;
        break;
      case "negative":
        validationErrorMessage = t.admin.validationNegativeAmount;
        break;
      case "zero":
        validationErrorMessage = t.admin.validationZeroAmount;
        break;
      case "too_many_decimals":
        validationErrorMessage = t.admin.validationTooManyDecimals;
        break;
      case "invalid_format":
      default:
        validationErrorMessage = t.admin.validationInvalidAmount;
        break;
    }
  }

  const isFormValid = validation.success && isFuji && Boolean(effectiveRecipient.trim() && isAddress(effectiveRecipient.trim()));

  return (
    <div className="border border-line bg-surface p-6 space-y-4">
      <div className="flex items-start gap-2">
        <Coins className="h-5 w-5 shrink-0 text-money" />
        <div className="min-w-0">
          <h3 className="text-base font-bold text-foreground tracking-tight">
            {t.admin.mintTestUsdcTitle}
          </h3>
          <p className="text-xs text-muted">
            {t.admin.mintTestUsdcDesc}
          </p>
        </div>
      </div>

      <p className="break-words text-xs text-muted" role="status">{t.tokenBalance.recipient}: {recipientBalance.isError ? t.tokenBalance.error : recipientBalance.isReady ? formatUsdc(recipientBalance.balance!) : recipientBalance.isLoading ? t.tokenBalance.loading : t.tokenBalance.unavailable}</p>
      <form onSubmit={handleOpenConfirm} className="space-y-4">
        <Input
          label={t.admin.mintRecipientLabel}
          type="text"
          value={effectiveRecipient}
          placeholder="0x..."
          disabled={isPending}
          onChange={(e) => {
            setRecipient(e.target.value);
            if (recipientError) setRecipientError(null);
          }}
          error={recipientError ?? undefined}
          required
        />

        <div className="space-y-1.5">
          <Input
            label={t.admin.mintAmountLabel}
            type="text"
            inputMode="decimal"
            placeholder="1000"
            value={amount}
            disabled={isPending}
            onChange={(e) => setAmount(e.target.value)}
            suffixElement="USDC"
            error={validationErrorMessage ?? undefined}
            required
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted">Quick amounts:</span>
            {quickChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setAmount(chip.value)}
                disabled={isPending}
                className="rounded-xs border border-line bg-surface-2 px-2.5 py-1 text-xs font-mono font-semibold text-foreground hover:bg-surface hover:border-line-strong transition-colors disabled:opacity-50"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={!isFormValid || isPending}
          isLoading={isPending}
          className="text-xs font-bold py-2.5"
        >
          {isPending ? t.admin.mintingOnFuji : t.admin.mintBtn}
        </Button>
      </form>

      {/* Confirmation Dialog */}
      <Dialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={t.admin.confirmMintTitle}
        description={t.admin.confirmMintNotice}
      >
        <div className="space-y-4 pt-3 text-xs">
          <div className="border border-line bg-surface-2 p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="role-label text-muted">{t.admin.mintAmountLabel}:</span>
              <span className="role-value-md text-money">
                {validation.success ? formatUsdc(validation.amount) : `${amount} USDC`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="role-label text-muted">{t.admin.mintRecipientLabel}:</span>
              <span className="font-mono text-foreground break-all select-all">
                {effectiveRecipient.trim()}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isPending}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmMint}
              isLoading={isPending}
              disabled={isPending}
              className="font-bold gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              {t.common.confirm}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
