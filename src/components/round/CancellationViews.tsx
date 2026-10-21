"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { explorerAddressUrl } from "@/lib/explorer";
import { formatUnits } from "viem";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/context/locale";
import { matchesCancellationInput, type RefundRow } from "@/lib/roundRefunds";

export interface CancelRoundDialogProps {
  name?: string;
  address: string;
  ended: boolean;
  totalDonated?: bigint;
  supporterCount?: number;
  pool: bigint;
  statsLoading?: boolean;
  statsError?: boolean;
  pending: boolean;
  error?: string;
  blocked?: string;
  explorerUrl?: string;
  onClose: () => void;
  onConfirm: () => void;
  onRetryStats?: () => void;
}

export function CancelRoundDialog({
  name,
  address,
  ended,
  totalDonated,
  supporterCount,
  pool,
  statsLoading = false,
  statsError = false,
  pending,
  error,
  blocked,
  explorerUrl,
  onClose,
  onConfirm,
  onRetryStats,
}: CancelRoundDialogProps) {
  const { t } = useLocale();
  const c = t.cancellation;
  const [input, setInput] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const closeState = useRef({ pending, onClose });
  useEffect(() => {
    closeState.current = { pending, onClose };
  }, [pending, onClose]);
  const close = useCallback(() => {
    if (!closeState.current.pending) closeState.current.onClose();
  }, []);

  // Confirm button ONLY depends on matching input, not being blocked on-chain, and not pending
  const allowed = matchesCancellationInput(input, name, address) && !blocked && !pending;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopyMessage(t.wallet.copied);
    } catch {
      setCopyMessage(t.moderation.copyFailed);
    }
  }

  const targetExplorerUrl = explorerUrl || explorerAddressUrl(address);

  return (
    <Dialog isOpen onClose={close} title={c.confirmTitle}>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted">{c.roundName}</dt>
          <dd className="font-semibold">{name || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">{c.roundAddress}</dt>
          <dd className="break-all font-mono text-xs">{address}</dd>
          <dd>
            <Button variant="ghost" size="sm" onClick={() => void copy()}>
              {t.common.copyAddress}
            </Button>
            <span aria-live="polite">{copyMessage}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted">{c.status}</dt>
          <dd>{ended ? c.ended : c.running}</dd>
        </div>
        <div>
          <dt className="text-muted">{c.donations}</dt>
          <dd>
            {statsLoading ? (
              <span className="inline-block h-4 w-20 animate-pulse bg-line/60 rounded" />
            ) : statsError ? (
              <span className="text-primary">{c.statsError}</span>
            ) : (
              `${formatUnits(totalDonated ?? 0n, 6)} USDC`
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{c.donors}</dt>
          <dd>
            {statsLoading ? (
              <span className="inline-block h-4 w-12 animate-pulse bg-line/60 rounded" />
            ) : statsError ? (
              <span className="text-primary">{c.statsError}</span>
            ) : (
              supporterCount ?? 0
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted">{c.pool}</dt>
          <dd>{formatUnits(pool, 6)} USDC</dd>
        </div>
      </dl>

      {statsError && onRetryStats && (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRetryStats}>
            {t.common.retry}
          </Button>
        </div>
      )}

      {/* Explorer link for contribution history */}
      <div className="mt-4 border-t border-line/50 pt-3 text-sm">
        <a
          href={targetExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary underline hover:opacity-80 inline-flex items-center gap-1"
        >
          {c.viewHistory} ({c.historyExplorerLink}) ↗
        </a>
      </div>

      <p className="my-4 border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
        {c.explanation}
      </p>

      <label className="block space-y-2 text-sm">
        <span>{c.typeName.replace("{suffix}", address.slice(-6))}</span>
        <input
          autoComplete="off"
          className="w-full border border-line bg-bg p-2 font-mono text-sm focus-visible:outline focus-visible:outline-primary"
          value={input}
          disabled={pending}
          onChange={event => setInput(event.target.value)}
        />
      </label>

      {blocked && <p role="status" className="mt-3 text-sm text-primary">{blocked}</p>}
      {error && <p role="alert" className="mt-3 break-words text-sm text-primary">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" className="focus-visible:ring-2 focus-visible:ring-primary/60" disabled={pending} onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button
          variant="destructive"
          className="focus-visible:ring-2 focus-visible:ring-primary/60"
          disabled={!allowed}
          isLoading={pending}
          title={!allowed ? blocked || c.typeRequired : undefined}
          onClick={() => {
            if (allowed) onConfirm();
          }}
        >
          {pending ? c.processing : c.confirm}
        </Button>
      </div>
    </Dialog>
  );
}

export function DonorRefundTable({
  rows,
  total,
  pending,
  onRefund,
  onRefundAll,
  projectNames = {},
}: {
  projectNames?: Record<string, string>;
  rows: RefundRow[];
  total: bigint;
  pending: boolean;
  onRefund: (id: bigint) => void;
  onRefundAll: () => void;
}) {
  const { t } = useLocale();
  const c = t.cancellation;

  if (!rows.length) return <p>{c.noRefund}</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">{c.project}</th>
              <th className="p-2">{c.amount}</th>
              <th className="p-2">{c.action}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.projectId.toString()} className="border-t border-line">
                <td className="p-2">{projectNames[row.projectId.toString()] || `#${row.projectId}`}</td>
                <td className="p-2 font-mono">{formatUnits(row.refunded ? row.originalAmount : row.amount, 6)} USDC</td>
                <td className="p-2">
                  {row.refunded ? (
                    <span className="text-money">{c.refunded}</span>
                  ) : (
                    <Button size="sm" disabled={pending} onClick={() => onRefund(row.projectId)}>
                      {c.refundOne}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-semibold">
        {c.total}: {formatUnits(total, 6)} USDC
      </p>
      <Button disabled={pending || total === 0n} isLoading={pending} onClick={onRefundAll}>
        {c.refundAll}
      </Button>
    </div>
  );
}

export function PoolRecoveryCard({
  pool,
  withdrawn,
  pending,
  onWithdraw,
}: {
  pool: bigint;
  withdrawn: boolean;
  pending: boolean;
  onWithdraw: () => void;
}) {
  const { t } = useLocale();
  const c = t.cancellation;
  return (
    <section className="space-y-3 border border-line p-4" aria-label={c.withdrawTitle}>
      <h3 className="font-semibold">{c.withdrawTitle}</h3>
      <p className="font-mono">{formatUnits(withdrawn ? 0n : pool, 6)} USDC</p>
      <p className="text-sm text-muted">{c.poolOnly}</p>
      <Button disabled={pending || withdrawn} isLoading={pending} onClick={onWithdraw}>
        {withdrawn ? c.withdrawn : c.withdrawTitle}
      </Button>
    </section>
  );
}
