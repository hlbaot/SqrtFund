"use client";
import { useMemo, useRef, useState } from "react";
import type { Address } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useRound } from "@/hooks/useRound";
import { useProjects } from "@/hooks/useProjects";
import { useRoundRefunds } from "@/hooks/useRoundRefunds";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { useTxFlow } from "@/hooks/useTxFlow";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { canCancelRound } from "@/lib/roundRefunds";
import { calculateRoundStats } from "@/lib/roundStats";
import { getContractErrorMessage, isUserRejected } from "@/lib/errors";
import { useLocale } from "@/lib/context/locale";
import { Button } from "@/components/ui/Button";
import { CancelRoundDialog, DonorRefundTable, PoolRecoveryCard } from "./CancellationViews";

type Action = "cancelRound" | "withdrawPoolIfCancelled" | "refund" | "refundMany";

export function RoundCancellationPanel({
  roundAddress: selected,
  adminControls = false,
  projectNames,
}: {
  roundAddress?: Address;
  adminControls?: boolean;
  projectNames?: Record<string, string>;
}) {
  const round = useRound(selected);
  const { projects, isLoading: isProjectsLoading, isError: isProjectsError, refetch: refetchProjects } = useProjects(round.roundAddress);
  const stats = useMemo(() => calculateRoundStats(projects), [projects]);

  const { address, isConnected, chainId } = useAccount();
  const { t, locale } = useLocale();
  const c = t.cancellation;
  const now = useCurrentTimestamp();
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const beginFlow = useTxFlow();
  const queries = useQueryClient();

  const [pending, setPending] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);

  const ready = isConnected && chainId === TARGET_CHAIN_ID;
  const viewer = ready ? address : undefined;
  const isAdmin = Boolean(viewer && viewer.toLowerCase() === round.admin?.toLowerCase());
  const cancelAllowed = adminControls && canCancelRound(round, viewer) && !round.isError;

  const refunds = useRoundRefunds(
    round.roundAddress,
    round.projectCount,
    viewer,
    Boolean(viewer && round.isCancelled)
  );
  const refundableIds = refunds.rows.filter(row => row.amount > 0n).map(row => row.projectId);

  const [prevScope, setPrevScope] = useState(() => `${round.roundAddress}-${viewer}`);
  const currentScope = `${round.roundAddress}-${viewer}`;
  if (prevScope !== currentScope) {
    setPrevScope(currentScope);
    setConfirm(false);
    setError(undefined);
  }

  async function transact(action: Action, projectId?: bigint) {
    if (busy.current || !client || !round.roundAddress || !viewer || round.isError) return;
    if (action === "cancelRound" && !cancelAllowed) return;
    if (action !== "cancelRound" && !round.isCancelled) return;
    if (action === "withdrawPoolIfCancelled" && (!adminControls || !isAdmin || round.cancelledPoolWithdrawn)) return;
    if ((action === "refund" || action === "refundMany") && (!refunds.isReady || refunds.total === 0n)) return;
    if (action === "refund" && !refunds.rows.some(row => row.projectId === projectId && row.amount > 0n)) return;
    if (action === "refundMany" && (!refunds.maxProjects || BigInt(refundableIds.length) > refunds.maxProjects || refundableIds.length === 0)) return;

    busy.current = true;
    setPending(action);
    setError(undefined);
    const flow = beginFlow("round-cancellation");
    const title =
      action === "cancelRound"
        ? t.phase2.cancelRound
        : action === "withdrawPoolIfCancelled"
        ? c.withdrawTitle
        : action === "refundMany"
        ? c.refundAll
        : c.refundOne;

    try {
      flow.toast.pending(action, title, c.processing);
      const hash = await flow.wait(() => {
        const common = { address: round.roundAddress!, abi: qfRoundAbi, chainId: TARGET_CHAIN_ID };
        if (action === "refund") return writeContractAsync({ ...common, functionName: "refund", args: [projectId!] });
        if (action === "refundMany") return writeContractAsync({ ...common, functionName: "refundMany", args: [refundableIds] });
        return writeContractAsync({ ...common, functionName: action });
      });
      flow.toast.pending(action, title, c.processing, hash);
      const receipt = await flow.wait(() => client.waitForTransactionReceipt({ hash }), 120_000);
      if (receipt.status !== "success") throw new Error(t.moderation.reverted);
      flow.toast.success(action, title, undefined, hash);
      setConfirm(false);
      round.refetch();
      await refunds.refetch();
      await queries.invalidateQueries();
    } catch (cause) {
      if (!flow.cancelled) {
        setError(isUserRejected(cause) ? t.transactions.rejectedDescription : getContractErrorMessage(cause, locale));
        flow.error(action, cause, title, locale);
      }
    } finally {
      flow.finish();
      busy.current = false;
      setPending(null);
    }
  }

  if (round.isLoading) return null;
  if (!round.supportsPhase2) return adminControls ? <p className="border border-line bg-surface p-4 text-sm text-muted">{t.phase2.phase2Required}</p> : null;
  if (!round.isCancelled && !cancelAllowed && !confirm) return null;

  const derivedProjectNames = projectNames || Object.fromEntries(projects.map(p => [p.id, p.name]));

  return (
    <section className="space-y-4 border border-primary/40 bg-surface p-4" aria-label={round.isCancelled ? c.banner : t.phase2.cancelRound}>
      {round.isCancelled ? (
        <>
          <h2 role="status" className="font-bold text-primary">{c.banner}</h2>
          {!viewer ? (
            <p>{c.connect}</p>
          ) : !refunds.isReady ? (
            <div>
              <p role="status">{refunds.isError ? c.readError : t.phase2.loading}</p>
              {refunds.isError && (
                <Button variant="secondary" onClick={() => void refunds.refetch()}>
                  {t.common.retry}
                </Button>
              )}
            </div>
          ) : (
            <DonorRefundTable
              projectNames={derivedProjectNames}
              rows={refunds.rows}
              total={refunds.total}
              pending={pending !== null}
              onRefund={id => void transact("refund", id)}
              onRefundAll={() => void transact("refundMany")}
            />
          )}
          {adminControls && isAdmin && (
            <PoolRecoveryCard
              pool={round.pool}
              withdrawn={round.cancelledPoolWithdrawn}
              pending={pending !== null}
              onWithdraw={() => void transact("withdrawPoolIfCancelled")}
            />
          )}
          {error && <p role="alert" className="text-sm text-primary">{error}</p>}
        </>
      ) : (
        cancelAllowed && (
          <Button
            variant="destructive"
            disabled={pending !== null}
            onClick={() => {
              setError(undefined);
              setConfirm(true);
            }}
          >
            {t.phase2.cancelRound}
          </Button>
        )
      )}

      {confirm && round.roundAddress && (
        <CancelRoundDialog
          key={round.roundAddress}
          name={round.name}
          address={round.roundAddress}
          ended={now > 0 && round.endTime !== undefined && BigInt(now) >= round.endTime}
          totalDonated={stats.totalDonatedRaw}
          supporterCount={stats.totalSupporters}
          pool={round.pool}
          statsLoading={isProjectsLoading}
          statsError={isProjectsError}
          onRetryStats={() => void refetchProjects()}
          pending={pending !== null}
          error={error}
          blocked={!cancelAllowed ? c.noLongerAllowed : undefined}
          onClose={() => {
            if (!busy.current) {
              setConfirm(false);
              setError(undefined);
            }
          }}
          onConfirm={() => void transact("cancelRound")}
        />
      )}
    </section>
  );
}
