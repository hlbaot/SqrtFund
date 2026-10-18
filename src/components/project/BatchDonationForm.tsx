"use client";
import { isPublicProject } from "@/lib/projectVisibility";
import { MatchingPoolWarning } from "./MatchingPoolWarning";
import { useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useProjects } from "@/hooks/useProjects";
import { useRound } from "@/hooks/useRound";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { tokenMatchesConfigured } from "@/lib/tokenBalance";
import { useDonate } from "@/hooks/useDonate";
import { useRole } from "@/hooks/useRole";
import { useLocale } from "@/lib/context/locale";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { parseUsdc } from "@/lib/format";
import { donationLimit } from "@/lib/studentAccess";
import { simulateDonationBatch } from "@/lib/qf";
import { Button } from "@/components/ui/Button";

export function BatchDonationForm({ roundAddress, onBack }: { roundAddress: Address; onBack: () => void }) {
  const { address } = useAccount(); const { t } = useLocale(); const c = t.phase2;
  const round = useRound(roundAddress); const { projects } = useProjects(roundAddress);
  const { canParticipate } = useRole(roundAddress); const query = useQueryClient();
  const { donateMany, isPending } = useDonate(roundAddress);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const approved = useMemo(() => projects.filter(isPublicProject), [projects]);
  const donations = useReadContracts({ allowFailure: true,
    contracts: approved.map(p => ({ address: roundAddress, abi: qfRoundAbi, functionName: "donationOf" as const, args: [address!, p.contractId] as const })),
    query: { enabled: Boolean(address && approved.length), refetchInterval: 15000 } });
  const remaining = useReadContract({ address: roundAddress, abi: qfRoundAbi, functionName: "remainingBudget", args: [address!], query: { enabled: Boolean(address), refetchInterval: 15000 } });
  const balance = useTokenBalance(address);
  const donorTotals = useMemo(() => Object.fromEntries(approved.map((p, i) => [p.id, typeof donations.data?.[i]?.result === "bigint" ? donations.data[i].result as bigint : 0n])), [approved, donations.data]);
  const selected = approved.filter(p => amounts[p.id]?.trim());
  const allocations = selected.map(p => { const result = parseUsdc(amounts[p.id]); return { id: p.id, amount: result.success ? result.amount : 0n, valid: result.success }; });
  const total = allocations.reduce((sum, a) => sum + a.amount, 0n);
  const loaded = typeof remaining.data === "bigint" && balance.isReady && tokenMatchesConfigured(round.token) && donations.data?.length === approved.length && donations.data.every(r => r.status === "success");
  const invalid = !round.minDonation || !round.maxDonation || allocations.some(a => !a.valid || donationLimit(a.amount, round.minDonation!, round.maxDonation!, donorTotals[a.id] ?? 0n, remaining.data ?? 0n) !== null) || total > (remaining.data ?? 0n);
  const insufficient = balance.isReady && balance.balance !== undefined && total > balance.balance;
  const expected = simulateDonationBatch(approved.map(p => ({ id: p.id, sumSqrt: p.sumSqrtRaw, totalDonated: p.totalDonatedRaw })), donorTotals, allocations, round.pool, round.maxMatchBps ?? 3000n);
  async function submit() {
    if (!loaded || invalid || insufficient || !canParticipate || !selected.length || isPending || round.status !== "open" || !round.supportsPhase2) return;
    const ok = await donateMany(selected.map(p => p.contractId), allocations.map(a => a.amount));
    if (ok) { setAmounts({}); await query.invalidateQueries(); }
  }
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{c.splitBudget}</h2><Button variant="ghost" disabled={isPending} onClick={onBack}>{c.singleProject}</Button></div>
    <p className="text-sm text-muted">{c.expectedHint}</p>
    {round.token && !tokenMatchesConfigured(round.token) && <p role="alert">{t.tokenBalance.tokenMismatch}</p>}
    {!balance.isReady && <p role="status">{balance.isError ? t.tokenBalance.error : balance.isLoading ? t.tokenBalance.loading : t.tokenBalance.unavailable}</p>}
    <MatchingPoolWarning totalRaw={expected.reduce((sum, p) => sum + p.raw, 0n)} pool={round.pool} />
    <p className="text-sm">{t.donateBox.roundBudgetRemaining.replace("{remaining}", formatUnits(remaining.data ?? 0n, 6)).replace("{max}", formatUnits(round.maxPerRound ?? 0n, 6))}</p>
    <div className="max-h-[28rem] space-y-3 overflow-auto">
      {approved.map(p => <div key={p.id} className="space-y-2 border border-line p-3">
        <label className="block text-sm"><span className="font-semibold">{p.name}</span><input aria-label={`${c.allocation}: ${p.name}`} type="text" inputMode="decimal" autoComplete="off" placeholder="0 USDC" value={amounts[p.id] ?? ""}
          disabled={!canParticipate || !loaded || isPending || round.status !== "open" || p.ownerAddress.toLowerCase() === address?.toLowerCase()}
          onChange={event => setAmounts(current => ({ ...current, [p.id]: event.target.value }))}
          className="mt-2 w-full border border-line bg-bg p-2" /></label>
        <p className="text-xs text-money">{c.expectedMatching}: {formatUnits(expected.find(item => String(item.id) === p.id)?.payout ?? 0n, 6)} USDC</p>
      </div>)}
    </div>
    <p className="font-semibold">{c.total}: {formatUnits(total, 6)} USDC</p>
    {selected.length > 0 && (invalid || insufficient) && <p role="alert" className="text-sm text-primary">{insufficient ? c.insufficientBalance : c.invalidAllocation}</p>}
    <Button fullWidth disabled={!loaded || !canParticipate || !selected.length || invalid || insufficient || isPending || round.status !== "open"} isLoading={isPending} onClick={() => void submit()}>{c.confirmDonation}</Button>
  </section>;
}
