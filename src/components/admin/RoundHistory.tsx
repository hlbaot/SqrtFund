"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { IMMUTABLE_STALE_MS, QUERY_GC_MS } from "@/lib/queryPolicy";
import { useLocale } from "@/lib/context/locale";
import { fmt } from "@/lib/copy";

export function RoundHistory({ addresses, selected, selectedName, disabled, onSelect }: {
  addresses: Address[];
  selected?: Address;
  selectedName?: string;
  disabled?: boolean;
  onSelect: (address: Address) => void;
}) {
  const { t } = useLocale();
  const names = useReadContracts({
    allowFailure: true,
    contracts: addresses.map(address => ({ address, abi: qfRoundAbi, functionName: "name" as const, chainId: TARGET_CHAIN_ID })),
    query: { enabled: addresses.length > 0, staleTime: IMMUTABLE_STALE_MS, gcTime: QUERY_GC_MS },
  });
  const options = addresses.map((address, index) => {
    const result = names.data?.[index];
    const name = (address.toLowerCase() === selected?.toLowerCase() ? selectedName?.trim() : undefined)
      || (result?.status === "success" && typeof result.result === "string" ? result.result.trim() : "");
    const number = fmt(t.competition.round, { n: index + 1 });
    // Creation order provides a stable, readable identity even for unnamed legacy rounds.
    return { address, label: name ? `${number} · ${name}` : number };
  }).reverse();
  const hasFailures = names.isError || names.data?.some(result => result.status === "failure");

  return <div className="flex justify-end border-b border-line bg-surface-2/40 p-4 sm:p-5">
    <div className="w-full sm:max-w-sm">
      <label className="flex flex-col gap-2 text-xs text-muted">
        <span>{t.tokenBalance.selectRound}</span>
        <select aria-label={t.tokenBalance.selectRound} value={selected ?? ""} disabled={disabled || !options.length}
          className="min-h-11 w-full min-w-0 border border-line-strong bg-bg px-3 text-sm text-foreground transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-primary disabled:opacity-60"
          onChange={event => onSelect(event.target.value as Address)}>
          {!options.length && <option value="">{t.tokenBalance.noRound}</option>}
          {options.map(option => <option key={option.address} value={option.address}>{option.label}</option>)}
        </select>
      </label>
      {hasFailures && <button type="button" onClick={() => void names.refetch()} className="mt-2 text-xs text-muted underline underline-offset-4">
        {t.roundControls.retryNames}
      </button>}
    </div>
  </div>;
}
