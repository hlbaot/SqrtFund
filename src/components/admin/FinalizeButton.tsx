"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MatchingPoolWarning } from "@/components/project/MatchingPoolWarning";
import { useLocale } from "@/lib/context/locale";
import { formatUsdc } from "@/lib/format";
import type { calculateRoundSettlement } from "@/lib/roundStats";

export function FinalizeButton({ allowed, pending, disabled, open, onOpen, onClose, onConfirm, summary, pool, statsReady, error }: {
  allowed: boolean; pending: boolean; disabled: boolean; open: boolean;
  onOpen: () => void; onClose: () => void; onConfirm: () => void;
  summary: ReturnType<typeof calculateRoundSettlement>; pool?: bigint; statsReady: boolean; error?: string;
}) {
  const { t } = useLocale();
  const c = t.roundControls;
  if (!allowed && !open) return null;
  const rows = [
    [c.pool, pool], [c.donations, summary.totalDonatedRaw],
    [c.estimatedMatching, summary.matching], [c.estimatedLeftover, summary.leftover],
  ] as const;
  return <>
    {allowed && <Button className="focus-visible:ring-2 focus-visible:ring-primary/60" type="button" variant="primary" disabled={disabled} isLoading={pending} onClick={onOpen} aria-label={c.finalize}>
      {c.finalize}
    </Button>}
    <Dialog isOpen={open} onClose={onClose} title={c.confirmFinalize}>
      <p className="text-xs leading-relaxed text-muted">{c.finalizeWarning}</p>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        {rows.map(([label, value]) => value !== undefined && <div key={label} className="border border-line bg-surface p-3">
          <dt className="text-muted">{label}</dt><dd className="mt-1 font-mono text-foreground">{formatUsdc(value)}</dd>
        </div>)}
      </dl>
      {summary.totalRaw !== undefined && pool !== undefined && <div className="mt-3"><MatchingPoolWarning totalRaw={summary.totalRaw} pool={pool} /></div>}
      {!statsReady && <p role="status" className="mt-3 text-xs text-muted">{c.statsUnavailable}</p>}
      {!allowed && <p role="status" className="mt-3 text-xs text-muted">{c.actionChanged}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-primary">{error}</p>}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button className="focus-visible:ring-2 focus-visible:ring-primary/60" type="button" variant="secondary" disabled={pending} onClick={onClose}>{t.common.cancel}</Button>
        <Button className="focus-visible:ring-2 focus-visible:ring-primary/60" type="button" variant="primary" disabled={!allowed || !statsReady || disabled} isLoading={pending} onClick={onConfirm}>{c.confirmFinalize}</Button>
      </div>
    </Dialog>
  </>;
}
