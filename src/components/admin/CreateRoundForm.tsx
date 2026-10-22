"use client";

import { useTxFlow } from "@/hooks/useTxFlow";

import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { mockUsdcAbi, roundFactoryAbi } from "@/lib/contracts/abis";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { factoryAddress, usdcAddress, TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { fundRound, parseInitialPool } from "@/lib/roundFunding";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { fmt } from "@/lib/copy";
import { useInitialPoolDeposit } from "@/hooks/useInitialPoolDeposit";
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
  const [pending, setPending] = useState<"deposit" | "create" | "withdraw" | null>(null);
  const isSubmitting = pending !== null;
  const busy = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const deposit = useInitialPoolDeposit(address);
  const [initialPool, setInitialPool] = useState("");
  const poolValidation = parseInitialPool(initialPool);
  const initialAmount = poolValidation.success ? poolValidation.amount : 0n;
  const credit = deposit.credit ?? 0n;
  const remaining = initialAmount > credit ? initialAmount - credit : 0n;
  const poolError = !poolValidation.success || (initialPool.trim() !== "" && initialAmount === 0n)
    ? t.admin.initialPoolInvalid : undefined;
  const funded = initialAmount > 0n && deposit.credit !== undefined && credit >= initialAmount;
  const canDeposit = deposit.canDeposit;
  const ready = isConnected && chainId === TARGET_CHAIN_ID && deposit.supported && !deposit.isError && canDeposit && deposit.credit !== undefined;
  const insufficientBalance = balance.isReady && balance.balance !== undefined && remaining > balance.balance;

  const roundNameBytes = React.useMemo(
    () => new TextEncoder().encode(roundName.trim()).length,
    [roundName]
  );
  const organizerBytes = React.useMemo(
    () => new TextEncoder().encode(organizer.trim()).length,
    [organizer]
  );

  function validateRound() {
    if (!formRef.current?.reportValidity()) return;
    const trimmedName = roundName.trim(), trimmedOrg = organizer.trim();
    const nameValid = roundNameBytes > 0 && roundNameBytes <= 60;
    const orgValid = organizerBytes <= 60;
    setNameError(nameValid ? null : roundNameBytes === 0 ? t.admin.validationRoundNameRequired : t.admin.validationRoundNameTooLong);
    setOrganizerError(orgValid ? null : t.admin.validationOrganizerTooLong);
    if (!nameValid || !orgValid || !poolValidation.success || initialAmount <= 0n) return;
    const start = Math.floor(new Date(startDateTime).getTime() / 1000);
    const end = Math.floor(new Date(endDateTime).getTime() / 1000);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end <= Date.now() / 1000) {
      throw new Error(t.toasts.invalidScheduleDesc);
    }
    const minimum = parseUsdc(minDonationUsdc), maximum = parseUsdc(maxDonationUsdc), budget = parseUsdc(maxPerRoundUsdc);
    const percent = Number(maxMatchPercent);
    if (!minimum.success || !maximum.success || !budget.success || minimum.amount > maximum.amount || budget.amount < maximum.amount
      || !Number.isFinite(percent) || percent < 1 || percent > 100) throw new Error(t.admin.invalidRoundBudget);
    return [trimmedName, trimmedOrg, usdcAddress, BigInt(start), BigInt(end), minimum.amount, maximum.amount,
      BigInt(Math.round(percent * 100)), budget.amount, initialAmount] as const;
  }

  async function act(action: "deposit" | "create" | "withdraw") {
    if (busy.current || !address || !publicClient || !isConnected || chainId !== TARGET_CHAIN_ID || !deposit.supported) return;
    if (action !== "withdraw" && !ready) return;
    busy.current = true;
    const flow = beginFlow("create-round-funding");
    const toastId = `initial-pool-${action}`;
    const title = action === "deposit" ? t.admin.initialPoolDeposit : action === "withdraw" ? t.admin.initialPoolWithdraw : t.admin.createRoundBtn;
    try {
      const args = action === "withdraw" ? undefined : validateRound();
      if (action !== "withdraw" && !args) return;
      setPending(action);
      // Re-read credit at each action: never trust a success flag or another tab's stale balance.
      const saved = await flow.wait(() => publicClient.readContract({ address: factoryAddress, abi: roundFactoryAbi,
        functionName: "initialPoolDeposits", args: [address, usdcAddress] }));
      const confirm = async (hash: `0x${string}`) => {
        flow.toast.pending(toastId, title, t.toasts.confirmingOnChain, hash);
        const receipt = await flow.wait(() => publicClient.waitForTransactionReceipt({ hash }), 120_000);
        if (receipt.status !== "success") throw new Error(t.admin.initialPoolTransactionFailed);
        return receipt;
      };
      if (action === "deposit") {
        const amount = args![9] > saved ? args![9] - saved : 0n;
        if (amount === 0n) { await deposit.refetch(); return; }
        await fundRound(amount, {
          allowance: () => flow.wait(() => publicClient.readContract({ address: usdcAddress, abi: mockUsdcAbi, functionName: "allowance", args: [address, factoryAddress] })),
          approve: () => {
            flow.toast.pending(toastId, t.toasts.depositApproveStep, t.toasts.confirmInWallet);
            return flow.wait(() => writeContractAsync({ address: usdcAddress, abi: mockUsdcAbi, functionName: "approve", args: [factoryAddress, amount], chainId: TARGET_CHAIN_ID }));
          },
          deposit: () => {
            flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
            return flow.wait(() => writeContractAsync({ address: factoryAddress, abi: roundFactoryAbi, functionName: "depositInitialPool", args: [usdcAddress, amount], chainId: TARGET_CHAIN_ID }));
          },
          confirm: async hash => { await confirm(hash); },
        });
        flow.toast.success(toastId, t.admin.initialPoolDeposited);
      } else if (action === "create") {
        if (saved < args![9]) throw new Error(t.admin.initialPoolRequired);
        flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
        const hash = await flow.wait(() => writeContractAsync({ address: factoryAddress, abi: roundFactoryAbi,
          functionName: "createFundedRound", args: args!, chainId: TARGET_CHAIN_ID }));
        await confirm(hash);
        flow.toast.success(toastId, t.toasts.roundCreatedTitle, t.toasts.roundCreatedDesc, hash);
        setRoundName(""); setOrganizer(""); setInitialPool("");
        refetch();
      } else {
        if (saved <= 0n) { await deposit.refetch(); return; }
        flow.toast.pending(toastId, title, t.toasts.confirmInWallet);
        const hash = await flow.wait(() => writeContractAsync({ address: factoryAddress, abi: roundFactoryAbi,
          functionName: "withdrawInitialPool", args: [usdcAddress, saved], chainId: TARGET_CHAIN_ID }));
        await confirm(hash);
        flow.toast.success(toastId, t.admin.initialPoolWithdrawn, undefined, hash);
      }
    } catch (error) {
      if (!flow.cancelled) flow.error(toastId, error, title, locale);
    } finally {
      flow.finish(); busy.current = false;
      if (!flow.cancelled) {
        setPending(null);
        await deposit.refetch();
        await queries.invalidateQueries();
      }
    }
  }

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

      <form ref={formRef} onSubmit={event => { event.preventDefault(); void act("create"); }}>
        <fieldset disabled={isSubmitting} className="space-y-3.5">
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

          <div className="border-t border-line pt-4 space-y-3">
            <Input label={t.admin.initialPoolLabel} type="text" inputMode="decimal" required
              placeholder="0" value={initialPool} onChange={event => setInitialPool(event.target.value)}
              className="min-h-12 pr-48" error={poolError}
              suffixElement={<div className="flex items-center gap-3">
                <span>USDC</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => void act("deposit")}
                  isLoading={pending === "deposit"} disabled={isSubmitting || !ready || !initialAmount || Boolean(poolError) || funded || !balance.isReady || insufficientBalance}
                  title={funded ? t.admin.initialPoolDeposited : undefined}
                  className={`shrink-0 text-xs ${funded ? "border-money/40 text-money disabled:opacity-100 disabled:text-money" : ""}`}>
                  {funded ? t.admin.initialPoolConfirmed : pending === "deposit" ? t.admin.initialPoolDepositing : t.admin.initialPoolDeposit}
                </Button>
              </div>} />
            <p className="text-xs text-muted">{t.admin.initialPoolHint}</p>
            <p role="status" className="text-xs text-muted font-mono">
              {balance.isReady && balance.balance !== undefined ? fmt(t.admin.adminBalanceLabel, { balance: formatUsdc(balance.balance, { includeSymbol: false }) })
                : balance.isError ? t.tokenBalance.error : balance.isLoading ? t.tokenBalance.loading : t.tokenBalance.unavailable}
            </p>
            {insufficientBalance && <p role="alert" className="text-xs text-primary">{t.admin.validationExceedsBalance}</p>}
            {deposit.isLoading ? <p role="status" className="text-xs text-muted">{t.common.loading}</p>
              : (!deposit.supported || deposit.isError) ? <div role="status" className="space-y-2 text-xs text-muted">
                <p>{deposit.isUnsupported ? t.admin.initialPoolUpgradeRequired : t.admin.initialPoolUnavailable}</p>
                {!deposit.isUnsupported && <button type="button" onClick={() => void deposit.refetch()} className="underline underline-offset-4">{t.tokenBalance.retry}</button>}
              </div> : !canDeposit && <p role="status" className="text-xs text-muted">{t.admin.initialPoolOwnerOnly}</p>}
            {deposit.credit !== undefined && credit > 0n && <div role="status" className="flex flex-wrap items-center justify-between gap-3 border border-money/30 bg-money/5 p-3">
              <p className="text-xs text-money">{fmt(t.admin.initialPoolCredit, { amount: formatUsdc(credit, { includeSymbol: false }) })}</p>
              <Button type="button" size="sm" variant="ghost" isLoading={pending === "withdraw"}
                disabled={isSubmitting || !isConnected || chainId !== TARGET_CHAIN_ID || !deposit.supported}
                onClick={() => void act("withdraw")}>{t.admin.initialPoolWithdraw}</Button>
            </div>}
          </div>

          <div className="pt-2">
            <p role="status" className={`mb-3 text-xs ${funded ? "text-money" : "text-muted"}`}>
              {funded ? t.admin.initialPoolReadyToCreate : t.admin.initialPoolRequired}
            </p>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isSubmitting || !ready || !funded || Boolean(poolError)}
              isLoading={pending === "create"}
              className="text-xs font-bold py-2.5"
            >
              {pending === "create" ? t.admin.deployingOnFuji : t.admin.createRoundBtn}
            </Button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
