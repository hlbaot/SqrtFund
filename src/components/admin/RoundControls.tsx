"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import type { useRound } from "@/hooks/useRound";
import type { EnrichedProject } from "@/hooks/useProjects";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useTxFlow } from "@/hooks/useTxFlow";
import { useLocale } from "@/lib/context/locale";
import { deriveRoundActions, FINALIZE_GRACE } from "@/lib/roundPhase";
import { calculateRoundSettlement, calculateRoundStats } from "@/lib/roundStats";
import { formatUsdc, shortAddress } from "@/lib/format";
import { tokenMatchesConfigured } from "@/lib/tokenBalance";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { getContractErrorMessage } from "@/lib/errors";
import { Stepper, type StepItem } from "@/components/tx/Stepper";
import { CountdownTimer } from "@/components/round/CountdownTimer";
import { CancelRoundDialog } from "@/components/round/CancellationViews";
import { Button } from "@/components/ui/Button";
import { StatusAlert } from "@/components/ui/StatusAlert";
import { DepositPoolButton } from "./DepositPoolButton";
import { FinalizeButton } from "./FinalizeButton";

type Action = "finalize" | "cancelRound" | "withdrawLeftover" | "withdrawPoolIfCancelled";

export function RoundControls({ round, projects, projectsLoading, projectsError, onSelectRound }: {
  round: ReturnType<typeof useRound>; projects: EnrichedProject[];
  projectsLoading: boolean; projectsError?: boolean; onSelectRound: (address: Address) => void;
}) {
  const { t, locale } = useLocale();
  const c = t.roundControls;
  const { address, isConnected, chainId } = useAccount();
  const viewer = isConnected && chainId === TARGET_CHAIN_ID ? address : undefined;
  const now = useCurrentTimestamp();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const queries = useQueryClient();
  const beginFlow = useTxFlow();
  const [pending, setPending] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<"finalize" | "cancelRound" | null>(null);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const close = useCallback(() => { if (!busy.current) { setConfirm(null); setError(undefined); } }, []);
  const actionRound = { ...round, depositSupported: tokenMatchesConfigured(round.token),
    isError: round.isError || (round.roundVersion === "current" && round.financials?.status === undefined) };
  const actions = deriveRoundActions(actionRound, now, viewer);
  const pool = round.financials?.pool;
  const summary = calculateRoundSettlement(!projectsLoading && !projectsError ? projects : undefined,
    pool, round.maxMatchBps, round.finalized ? round.financials?.leftover : undefined);
  const stats = calculateRoundStats(projects);
  const statsReady = !projectsLoading && !projectsError && summary.matching !== undefined && pool !== undefined;
  const disbursed = summary.allClaimed && (summary.leftover === 0n || round.leftoverWithdrawn);
  const currentStep = actions.phase === "finalized" ? 3 : actions.phase.startsWith("ended") ? 1 : 0;
  const steps: StepItem[] = [c.stepOpen, c.stepEnded, c.stepFinalized, c.stepDisbursed].map((label, index) => ({
    id: index + 1, label, state: index < currentStep || (actions.phase === "finalized" && disbursed)
      ? "completed" : index === currentStep ? "current" : "upcoming",
  }));

  async function transact(action: Action) {
    if (busy.current || !client || !round.roundAddress || !viewer) return;
    // Recheck against the shared live clock and current authority at confirmation.
    const fresh = deriveRoundActions(actionRound, now, viewer);
    const allowed = action === "finalize" ? fresh.finalize && statsReady : action === "cancelRound" ? fresh.cancel
      : action === "withdrawLeftover" ? fresh.withdrawLeftover : fresh.withdrawPool;
    if (!allowed) { setError(c.actionChanged); return; }
    busy.current = true; setPending(action); setError(undefined);
    const flow = beginFlow(`round-control:${round.roundAddress}`);
    const title = action === "finalize" ? t.toasts.finalizeTitle : action === "cancelRound" ? t.phase2.cancelRound
      : action === "withdrawLeftover" ? t.toasts.withdrawTitle : c.withdrawPool;
    try {
      flow.toast.pending(action, title, t.toasts.confirmInWallet);
      const hash = await flow.wait(() => writeContractAsync({ address: round.roundAddress!, abi: qfRoundAbi, functionName: action, chainId: TARGET_CHAIN_ID }));
      flow.toast.pending(action, title, t.toasts.confirmingOnChain, hash);
      const receipt = await flow.wait(() => client.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") throw new Error(t.moderation.reverted);
      flow.toast.success(action, action === "finalize" ? t.toasts.finalizeSuccess : action === "withdrawLeftover" ? t.toasts.withdrawSuccess : title, undefined, hash);
      setConfirm(null);
      round.refetch();
      await queries.invalidateQueries();
    } catch (cause) {
      if (!flow.cancelled) {
        setError(getContractErrorMessage(cause, locale));
        flow.error(action, cause, action === "finalize" ? t.toasts.finalizeFailed : title, locale);
      }
    } finally {
      flow.finish(); busy.current = false;
      if (!flow.cancelled) setPending(null);
    }
  }

  if (!round.roundAddress) return null;
  const timer = (end: bigint) => <CountdownTimer endTime={end} nowSeconds={now} inline />;
  const status = now <= 0 && !round.finalized && !round.isCancelled ? t.common.loading
    : !round.finalized && !round.isCancelled && round.endTime === undefined ? c.scheduleUnavailable
    : actions.phase === "notStarted" ? <>{c.opensIn} {round.startTime !== undefined ? timer(round.startTime) : "—"} · {c.finalizeUnlocksIn} {round.endTime !== undefined ? timer(round.endTime) : "—"}</>
    : actions.phase === "open" ? <>{c.endsIn} {round.endTime !== undefined ? timer(round.endTime) : "—"} · {c.finalizeAtEnd}</>
    : actions.phase === "endedGrace" ? <>{actions.isAdmin ? c.adminGraceRemaining : c.adminOnlyRemaining} {round.endTime !== undefined ? timer(round.endTime + FINALIZE_GRACE) : "—"}</>
    : actions.phase === "endedOpenToAll" ? c.everyoneCanFinalize
    : actions.phase === "finalized" ? (disbursed ? c.disbursed : c.readyToClaim) : c.refundHint;
  const results = [[c.allocatedMatching, summary.matching === undefined ? undefined : formatUsdc(summary.matching)],
    [c.leftover, summary.leftover === undefined ? undefined : formatUsdc(summary.leftover)], [c.matchingProjects, summary.matchingCount]] as const;
  return <section aria-label={c.title} className="space-y-5 border border-line bg-surface p-4 sm:p-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <h2 className="text-sm font-semibold text-foreground">{c.title}</h2>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted sm:max-w-sm sm:flex-1">
        <span>{t.tokenBalance.selectRound}</span>
        <select aria-label={t.tokenBalance.selectRound} value={round.roundAddress} disabled={pending !== null}
          className="min-h-9 w-full border border-line bg-bg px-3 text-xs text-foreground transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-primary"
          onChange={event => onSelectRound(event.target.value as Address)}>
          {Array.from(new Set(round.allRounds?.length ? round.allRounds : [round.roundAddress])).map(value => <option key={value} value={value}>{value === round.roundAddress && round.name ? round.name : shortAddress(value)}</option>)}
        </select>
      </label>
    </div>
    {actions.phase !== "cancelled" && <Stepper steps={steps} ariaLabel={c.progress} />}
    {actions.phase === "cancelled" ? <StatusAlert tone="warning" title={c.cancelled}>
      <Link href="/my" className="text-xs underline underline-offset-4 hover:text-foreground">{c.refundHint}</Link>
    </StatusAlert> : <div role="status" className="text-xs leading-relaxed text-muted">{status}</div>}
    {actionRound.isError && <p role="status" className="text-xs text-muted">{t.tokenBalance.roundError}</p>}
    {actions.phase === "finalized" && <dl className="grid gap-3 text-xs sm:grid-cols-3">
      {results.map(([label, value]) => value !== undefined && <div key={label} className="border border-line bg-surface-2/40 p-3"><dt className="text-muted">{label}</dt><dd className="mt-1 font-mono text-foreground">{value}</dd></div>)}
    </dl>}
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-label={c.actions} role="group">
      <FinalizeButton allowed={actions.finalize} pending={pending === "finalize"} disabled={pending !== null} open={confirm === "finalize"}
        onOpen={() => { setConfirm("finalize"); setError(undefined); }} onClose={close} onConfirm={() => void transact("finalize")}
        summary={summary} pool={pool} statsReady={statsReady} error={error} />
      {actions.deposit && <DepositPoolButton roundAddress={round.roundAddress} label={c.deposit} disabled={pending !== null} />}
      {actions.cancel && <Button className="focus-visible:ring-2 focus-visible:ring-primary/60" type="button" variant="destructive" disabled={pending !== null} onClick={() => { setConfirm("cancelRound"); setError(undefined); }} aria-label={c.cancel}>{c.cancel}</Button>}
      {actions.withdrawLeftover && <Button className="focus-visible:ring-2 focus-visible:ring-primary/60" type="button" variant="primary" disabled={pending !== null} isLoading={pending === "withdrawLeftover"} onClick={() => void transact("withdrawLeftover")} aria-label={c.withdrawLeftover}>{c.withdrawLeftover}</Button>}
      {actions.withdrawPool && <Button className="focus-visible:ring-2 focus-visible:ring-primary/60" type="button" variant="primary" disabled={pending !== null} isLoading={pending === "withdrawPoolIfCancelled"} onClick={() => void transact("withdrawPoolIfCancelled")} aria-label={c.withdrawPool}>{c.withdrawPool}</Button>}
      {actions.phase === "finalized" && round.leftoverWithdrawn && <span className="inline-flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{c.leftoverWithdrawn}</span>}
      {actions.phase === "cancelled" && round.cancelledPoolWithdrawn && <span className="inline-flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{c.poolWithdrawn}</span>}
    </div>
    {error && confirm === null && <p role="alert" className="text-xs text-primary">{error}</p>}
    {confirm === "cancelRound" && <CancelRoundDialog name={round.name} address={round.roundAddress}
      ended={actions.phase.startsWith("ended")} totalDonated={summary.totalDonatedRaw} supporterCount={stats.totalSupporters} pool={pool ?? round.pool}
      statsLoading={projectsLoading} statsError={projectsError} pending={pending !== null} error={error}
      blocked={!actions.cancel ? c.actionChanged : undefined} onClose={close} onConfirm={() => void transact("cancelRound")} />}
  </section>;
}
