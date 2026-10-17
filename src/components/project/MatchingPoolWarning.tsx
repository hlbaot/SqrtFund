"use client";
import { matchingCoverage } from "@/lib/qf";
import { useLocale } from "@/lib/context/locale";
export function MatchingPoolWarning({ totalRaw, pool }: { totalRaw: bigint; pool: bigint }) {
  const { t } = useLocale();
  const coverage = matchingCoverage(totalRaw, pool);
  if (!coverage.underfunded) return null;
  return <p role="status" className="border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">{t.phase2.poolUnderfunded.replace("{percent}", coverage.percent)}</p>;
}
