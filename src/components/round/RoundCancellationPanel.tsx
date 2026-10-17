"use client";
import { useMemo, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useRound } from "@/hooks/useRound";
import { useTxFlow } from "@/hooks/useTxFlow";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function RoundCancellationPanel({ roundAddress: selected, adminControls = false }: { roundAddress?: Address; adminControls?: boolean }) {
  const round = useRound(selected);
  const { address, isConnected, chainId } = useAccount();
  const { t, locale } = useLocale(); const c = t.phase2;
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const beginFlow = useTxFlow(); const queries = useQueryClient();
  const [pending, setPending] = useState(false); const [confirm, setConfirm] = useState(false);
  const ready = isConnected && chainId === TARGET_CHAIN_ID;
  const isAdmin = ready && address?.toLowerCase() === round.admin?.toLowerCase();
  const ids = useMemo(() => Array.from({ length: Math.min(Number(round.projectCount), 50) }, (_, i) => BigInt(i + 1)), [round.projectCount]);
  const reads = useReadContracts({ allowFailure: true, contracts: ids.map(id => ({ address: round.roundAddress!, abi: qfRoundAbi, functionName: "donationOf" as const, args: [address!, id] as const })),
    query: { enabled: Boolean(ready && round.isCancelled && round.roundAddress && ids.length), refetchInterval: 15000 } });
  const loaded = ids.length === 0 || Boolean(reads.data?.length === ids.length && reads.data.every(r => r.status === "success"));
  const refunds = ids.filter((_, index) => typeof reads.data?.[index]?.result === "bigint" && (reads.data[index].result as bigint) > 0n);
  const total = reads.data?.reduce((sum, r) => sum + (typeof r.result === "bigint" ? r.result : 0n), 0n) ?? 0n;
  async function transact(action: "cancelRound" | "withdrawPoolIfCancelled" | "refund") {
    if (pending || !client || !round.roundAddress || !ready) return;
    const flow = beginFlow("round-cancellation"); setPending(true);
    const title = action === "cancelRound" ? c.cancelRound : action === "refund" ? c.refund : c.withdrawPool;
    try {
      flow.toast.pending(action, title, c.processing);
      const hash = await flow.wait(() => action === "refund"
        ? writeContractAsync({ address: round.roundAddress!, abi: qfRoundAbi, functionName: "refundMany", args: [refunds], chainId: TARGET_CHAIN_ID })
        : writeContractAsync({ address: round.roundAddress!, abi: qfRoundAbi, functionName: action, chainId: TARGET_CHAIN_ID }));
      flow.toast.pending(action, title, c.processing, hash);
      const receipt = await flow.wait(() => client.waitForTransactionReceipt({ hash }), 120000);
      if (receipt.status !== "success") throw new Error("Transaction reverted");
      flow.toast.success(action, title, undefined, hash); setConfirm(false);
      round.refetch(); await queries.invalidateQueries();
    } catch (error) { if (!flow.cancelled) flow.error(action, error, title, locale); }
    finally { flow.finish(); setPending(false); }
  }
  if (round.isLoading) return null;
  if (!round.supportsPhase2) return adminControls ? <p className="border border-line bg-surface p-4 text-sm text-muted">{c.phase2Required}</p> : null;
  if (!round.isCancelled && (!isAdmin || round.finalized)) return null;
  return <section className="space-y-3 border border-primary/40 bg-surface p-4" aria-label={round.isCancelled ? c.cancelled : c.cancelRound}>
    {round.isCancelled ? <>
      <h2 className="font-bold text-primary">{c.cancelled}</h2><p className="text-sm text-muted">{c.cancelledHint}</p>
      {ready && (!loaded ? <p role="status">{c.loading}</p> : total > 0n ? <Button disabled={pending} isLoading={pending} onClick={() => void transact("refund")}>{c.refund} · {formatUnits(total, 6)} USDC</Button> : <p className="text-sm text-muted">{c.noRefund}</p>)}
      {isAdmin && (round.cancelledPoolWithdrawn ? <p>{c.poolReturned}</p> : <Button disabled={pending} onClick={() => void transact("withdrawPoolIfCancelled")}>{c.withdrawPool} · {formatUnits(round.pool, 6)} USDC</Button>)}
    </> : <Button variant="destructive" onClick={() => setConfirm(true)}>{c.cancelRound}</Button>}
    <Dialog isOpen={confirm} onClose={() => { if (!pending) setConfirm(false); }} title={c.cancelConfirm} description={c.cancelHint}>
      <div className="flex gap-3"><Button disabled={pending} variant="secondary" onClick={() => setConfirm(false)}>{t.common.cancel}</Button><Button variant="destructive" disabled={pending} isLoading={pending} onClick={() => void transact("cancelRound")}>{c.cancelRound}</Button></div>
    </Dialog>
  </section>;
}
