"use client";

import { useTxFlow } from "@/hooks/useTxFlow";

import React, { useState } from "react";
import { formatUnits, type Address } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { mockUsdcAbi, qfRoundAbi, roundFactoryAbi } from "@/lib/contracts/abis";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { factoryAddress, usdcAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { createdRoundAddress, fundRound, parseInitialPool } from "@/lib/roundFunding";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { fmt } from "@/lib/copy";
import { DepositPoolButton } from "./DepositPoolButton";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Format Date object to YYYY-MM-DDTHH:mm string in local timezone */
function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function CreateRoundForm() {
  const beginFlow = useTxFlow();
  const { t, locale } = useLocale();
  const { isConnected, address, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const queries = useQueryClient();
  const balance = useTokenBalance(address);
  const { writeContractAsync } = useWriteContract();
  const { refetch } = useRound();

  const [roundName, setRoundName] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [organizerError, setOrganizerError] = useState<string | null>(null);

  const [startDateTime, setStartDateTime] = useState(() => {
    if (typeof window === "undefined") return "";
    return toLocalDatetimeString(new Date(Date.now() + 2 * 60 * 1000));
  });
  const [endDateTime, setEndDateTime] = useState(() => {
    if (typeof window === "undefined") return "";
    return toLocalDatetimeString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  });
  const [tzLabel] = useState(() => {
    if (typeof window === "undefined") return "";
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const mins = Math.abs(offsetMinutes) % 60;
    return `GMT${sign}${hours}${mins > 0 ? `:${mins.toString().padStart(2, "0")}` : ""}`;
  });
  const [minDonationUsdc, setMinDonationUsdc] = useState("1");
  const [maxDonationUsdc, setMaxDonationUsdc] = useState("5");
  const [maxPerRoundUsdc, setMaxPerRoundUsdc] = useState("10");
  const [maxMatchPercent, setMaxMatchPercent] = useState("30");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialPool, setInitialPool] = useState("");
  const [unfunded, setUnfunded] = useState<{ address?: Address; amount: string } | null>(null);
  const poolValidation = parseInitialPool(initialPool, balance.isReady ? balance.balance : undefined);
  const poolError = !poolValidation.success ? (poolValidation.errorKey === "exceeds_balance" ? t.admin.validationExceedsBalance : t.admin.initialPoolInvalid) : undefined;
  const fundingNeedsBalance = poolValidation.success && poolValidation.amount > 0n && !balance.isReady;

  const roundNameBytes = React.useMemo(
    () => new TextEncoder().encode(roundName.trim()).length,
    [roundName]
  );
  const organizerBytes = React.useMemo(
    () => new TextEncoder().encode(organizer.trim()).length,
    [organizer]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    const flow = beginFlow();
    e.preventDefault();
    const toastId = "create-round";

    if (!isConnected || !address || chainId !== TARGET_CHAIN_ID || !factoryAddress || !publicClient) {
      flow.toast.error(
        toastId,
        t.toasts.factoryNotReadyTitle,
        t.toasts.factoryNotReadyDesc
      );
      return;
    }

    const trimmedName = roundName.trim();
    const trimmedOrg = organizer.trim();
    const nBytes = new TextEncoder().encode(trimmedName).length;
    const oBytes = new TextEncoder().encode(trimmedOrg).length;

    let hasValidationErr = false;
    if (nBytes === 0) {
      setNameError(t.admin.validationRoundNameRequired);
      hasValidationErr = true;
    } else if (nBytes > 60) {
      setNameError(t.admin.validationRoundNameTooLong);
      hasValidationErr = true;
    } else {
      setNameError(null);
    }

    if (oBytes > 60) {
      setOrganizerError(t.admin.validationOrganizerTooLong);
      hasValidationErr = true;
    } else {
      setOrganizerError(null);
    }

    if (hasValidationErr) return;
    if (!poolValidation.success || fundingNeedsBalance) {
      flow.toast.error(toastId, t.admin.initialPoolLabel, poolError ?? t.tokenBalance.unavailable);
      flow.finish(); return;
    }
    const initialAmount = poolValidation.amount;

    if (!startDateTime || !endDateTime) {
      flow.toast.error(
        toastId,
        t.toasts.invalidScheduleTitle,
        t.toasts.invalidScheduleDesc
      );
      return;
    }

    const startTimestamp = BigInt(Math.floor(new Date(startDateTime).getTime() / 1000));
    const endTimestamp = BigInt(Math.floor(new Date(endDateTime).getTime() / 1000));

    if (endTimestamp <= startTimestamp) {
      flow.toast.error(
        toastId,
        t.toasts.invalidScheduleTitle,
        t.toasts.invalidScheduleDesc
      );
      return;
    }

    const minParsed = parseUsdc(minDonationUsdc), maxParsed = parseUsdc(maxDonationUsdc);
    if (!minParsed.success || !maxParsed.success || minParsed.amount > maxParsed.amount) {
      flow.toast.error("create-round", t.admin.maxPerRoundLabel, t.admin.invalidRoundBudget); flow.finish(); return;
    }
    const minDonation = minParsed.amount, maxDonation = maxParsed.amount;
    const parsedBudget = parseUsdc(maxPerRoundUsdc);
    if (!parsedBudget.success || parsedBudget.amount < maxDonation || parsedBudget.amount < minDonation) {
      flow.toast.error("create-round", t.admin.maxPerRoundLabel, t.admin.invalidRoundBudget); flow.finish(); return;
    }
    const maxPerRound = parsedBudget.amount;
    const maxMatchBps = BigInt(Math.round(parseFloat(maxMatchPercent) * 100));

    setIsSubmitting(true);
    try {
      flow.toast.pending(
        toastId,
        t.toasts.creatingRoundTitle,
        t.toasts.confirmInWallet
      );

      const hash = await flow.wait(() => writeContractAsync({
        address: factoryAddress,
        abi: roundFactoryAbi,
        functionName: "createRound",
        chainId: TARGET_CHAIN_ID,
        args: [
          trimmedName,
          trimmedOrg,
          usdcAddress,
          startTimestamp,
          endTimestamp,
          minDonation,
          maxDonation,
          maxMatchBps,
          maxPerRound,
        ],
      }));

      flow.toast.pending(
        toastId,
        t.toasts.deployingRoundTitle,
        t.toasts.deployingRoundDesc,
        hash
      );

      const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") {
        throw new Error("createRound transaction reverted.");
      }

      flow.toast.success(
        toastId,
        t.toasts.roundCreatedTitle,
        t.toasts.roundCreatedDesc,
        hash
      );

      setRoundName("");
      setOrganizer("");
      refetch();
      await queries.invalidateQueries();
      if (initialAmount > 0n) {
        // The round is already deployed. Funding failure must never be reported as creation failure.
        let deployed: Address | undefined;
        try {
          deployed = createdRoundAddress(receipt.logs, factoryAddress, address, usdcAddress);
          if (!deployed) throw new Error(t.admin.initialPoolRoundMissing);
          const targetRound = deployed;
          await fundRound(initialAmount, {
            allowance: () => flow.wait(() => publicClient.readContract({ address: usdcAddress, abi: mockUsdcAbi, functionName: "allowance", args: [address, targetRound] })),
            approve: () => {
              flow.toast.pending("initial-pool", t.toasts.depositApproveStep, t.toasts.depositApproveDesc);
              return flow.wait(() => writeContractAsync({ address: usdcAddress, abi: mockUsdcAbi, functionName: "approve", args: [targetRound, initialAmount], chainId: TARGET_CHAIN_ID }));
            },
            deposit: () => {
              flow.toast.pending("initial-pool", t.toasts.depositStep, t.toasts.depositStepDesc);
              return flow.wait(() => writeContractAsync({ address: targetRound, abi: qfRoundAbi, functionName: "depositPool", args: [initialAmount], chainId: TARGET_CHAIN_ID }));
            },
            confirm: async fundingHash => {
              flow.toast.pending("initial-pool", t.admin.initialPoolConfirming, t.toasts.confirmingOnChain, fundingHash);
              const fundingReceipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash: fundingHash }), 120_000);
              if (fundingReceipt.status !== "success") throw new Error(t.admin.initialPoolFailed);
            },
          });
          flow.toast.success("initial-pool", t.toasts.depositSuccess);
          setInitialPool("");
          refetch();
          await queries.invalidateQueries();
        } catch (fundingError) {
          if (flow.cancelled) return;
          setUnfunded({ address: deployed, amount: formatUnits(initialAmount, 6) });
          flow.error("initial-pool", fundingError, t.admin.initialPoolFailed, locale);
        }
      }
    } catch (err: unknown) {
      if (flow.cancelled) return false;
      flow.error(
        toastId,
        err,
        t.toasts.createRoundFailed,
        locale
      );
    } finally {
      flow.finish();
      if (!flow.cancelled) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="border border-line bg-surface p-6 space-y-4">
      <div>
        <h3 className="text-base font-bold text-foreground tracking-tight">
          {t.admin.createRoundTitle}
        </h3>
        <p className="text-xs text-muted">
          {t.admin.deployRoundDesc}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={`${t.admin.roundNameLabel} *`}
            type="text"
            value={roundName}
            onChange={(e) => {
              setRoundName(e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder={t.admin.roundNamePlaceholder}
            suffixElement={
              <span
                className={`tabular-mono text-xs ${roundNameBytes > 60 ? "text-primary font-bold" : "text-muted"
                  }`}
              >
                {roundNameBytes}/60B
              </span>
            }
            error={
              nameError ||
              (roundNameBytes > 60 ? t.admin.validationRoundNameTooLong : undefined)
            }
            required
          />

          <Input
            label={`${t.admin.organizerLabel} (${t.admin.optionalLabel})`}
            type="text"
            value={organizer}
            onChange={(e) => {
              setOrganizer(e.target.value);
              if (organizerError) setOrganizerError(null);
            }}
            placeholder={t.admin.organizerPlaceholder}
            suffixElement={
              <span
                className={`tabular-mono text-xs ${organizerBytes > 60 ? "text-primary font-bold" : "text-muted"
                  }`}
              >
                {organizerBytes}/60B
              </span>
            }
            error={
              organizerError ||
              (organizerBytes > 60 ? t.admin.validationOrganizerTooLong : undefined)
            }
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={`${t.admin.startDateLabel}${tzLabel ? ` (${tzLabel})` : ""}`}
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            helperText={t.admin.deployScheduleHelper}
            required
          />
          <Input
            label={`${t.admin.endDateLabel}${tzLabel ? ` (${tzLabel})` : ""}`}
            type="datetime-local"
            value={endDateTime}
            onChange={(e) => setEndDateTime(e.target.value)}
            helperText={t.admin.deployClosingHelper}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label={t.admin.minDonationLabel}
            type="number"
            min="1"
            value={minDonationUsdc}
            onChange={(e) => setMinDonationUsdc(e.target.value)}
            suffixElement="USDC"
            required
          />
          <Input
            label={t.admin.maxDonationLabel}
            type="number"
            min="1"
            value={maxDonationUsdc}
            onChange={(e) => setMaxDonationUsdc(e.target.value)}
            suffixElement="USDC"
            required
          />
          <Input
            label={t.admin.matchCapLabel}
            type="number"
            min="1"
            max="100"
            value={maxMatchPercent}
            onChange={(e) => setMaxMatchPercent(e.target.value)}
            suffixElement="%"
            required
          />
        </div>

        <Input label={t.admin.maxPerRoundLabel} type="number" min={maxDonationUsdc} step="0.000001"
          value={maxPerRoundUsdc} onChange={event => setMaxPerRoundUsdc(event.target.value)} suffixElement="USDC"
          helperText={t.admin.invalidRoundBudget} required />

        <div className="border-t border-line pt-4 space-y-2">
          <Input label={`${t.admin.initialPoolLabel} (${t.admin.optionalLabel})`} type="text" inputMode="decimal"
            placeholder="0" value={initialPool} onChange={event => setInitialPool(event.target.value)}
            suffixElement="USDC" helperText={t.admin.initialPoolHint} error={poolError} disabled={isSubmitting} />
          <p role="status" className="text-xs text-muted font-mono">
            {balance.isReady && balance.balance !== undefined ? fmt(t.admin.adminBalanceLabel, { balance: formatUsdc(balance.balance, { includeSymbol: false }) })
              : balance.isError ? t.tokenBalance.error : balance.isLoading ? t.tokenBalance.loading : t.tokenBalance.unavailable}
          </p>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={isSubmitting || !isConnected || chainId !== TARGET_CHAIN_ID || Boolean(poolError) || fundingNeedsBalance}
            isLoading={isSubmitting}
            className="text-xs font-bold py-2.5"
          >
            {isSubmitting ? t.admin.deployingOnFuji : t.admin.createRoundBtn}
          </Button>
        </div>
      </form>
      {unfunded && <div role="status" className="space-y-3 border border-amber-400/20 bg-amber-400/5 p-3 text-xs">
        <p className="text-muted">{t.admin.initialPoolRetryHint}</p>
        <DepositPoolButton roundAddress={unfunded.address} amount={unfunded.amount} onDeposited={() => { setUnfunded(null); setInitialPool(""); }} />
      </div>}
    </div>
  );
}
