"use client";

import Link from "next/link";
import { useLocale } from "@/lib/context/locale";
import { fmt } from "@/lib/copy";
import { shortAddress } from "@/lib/format";
import { AnimatedNumber, CopyAddress, InfoTooltip, MetricBar } from "./Primitives";
import { displayNumber, matchingValue, type RankedProject } from "./model";

export function RankBadge({ project, large = false }: { project: RankedProject; large?: boolean }) {
  const { locale } = useLocale();
  return <span key={`${project.supporterRank}:${project.tied}`} className={`competition-rank tabular-mono font-bold tracking-tighter ${large ? "text-5xl" : "text-2xl"} ${project.supporterRank === 1 ? "text-primary" : "text-muted"}`}>{project.tied ? "=" : "#"}{displayNumber(project.supporterRank, locale, 0)}</span>;
}

export function ProjectIdentity({ project, roundId, wallet, stretched = false }: { project: RankedProject; roundId: string; wallet?: string; stretched?: boolean }) {
  const { t } = useLocale();
  const owner = wallet && wallet.toLowerCase() === project.ownerAddress.toLowerCase();
  return <div className="flex min-w-0 items-center gap-3">
    <span aria-hidden="true" className="tabular-mono flex h-10 w-10 shrink-0 items-center justify-center border border-line-strong bg-bg text-base font-semibold text-muted">{project.name.slice(0, 1).toUpperCase()}</span>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1"><Link href={`/round/${roundId}/project/${project.id}`} title={project.name} className={`competition-focus block min-w-0 flex-1 truncate text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer ${stretched ? "after:absolute after:inset-0" : ""}`}>{project.name}</Link>{project.name.length > 32 && <InfoTooltip label={project.name}>{project.name}</InfoTooltip>}</div>
      <div className="relative z-10 mt-1 flex w-fit max-w-full items-center gap-1 text-muted"><span className="tabular-mono truncate text-xs" title={project.ownerAddress}>{shortAddress(project.ownerAddress)}</span><CopyAddress address={project.ownerAddress} /></div>
      {(owner || project.supportedByWallet) && <div className="mt-1 flex flex-wrap gap-1">{owner && <span className="border border-primary/40 px-1.5 py-0.5 text-xs text-primary">{t.competition.yourProject}</span>}{project.supportedByWallet && <span className="border border-line-strong px-1.5 py-0.5 text-xs text-muted">{t.competition.supported}</span>}</div>}
    </div>
  </div>;
}

export function MatchingMetric({ project, finalized, pool, bar = true }: { project: RankedProject; finalized: boolean; pool: number; bar?: boolean }) {
  const { t, locale } = useLocale();
  const value = matchingValue(project, finalized);
  const share = pool > 0 && value !== undefined ? value / pool * 100 : 0;
  return <div className="min-w-0 text-money" title={value === undefined ? t.competition.finalUnavailable : undefined}>
    <div className="competition-number font-semibold">{value === undefined ? t.competition.unavailable : <AnimatedNumber value={value} />}</div>
    {value !== undefined && <><div className="mt-1 tabular-mono text-xs text-muted">{fmt(t.competition.poolShare, { value: displayNumber(share, locale, 2) })}</div>{bar && <MetricBar value={value} max={pool} money />}</>}
  </div>;
}

export function TotalMetric({ project, finalized }: { project: RankedProject; finalized: boolean }) {
  const { t } = useLocale();
  const matching = matchingValue(project, finalized);
  return <span className="competition-number block font-bold" title={matching === undefined ? t.competition.finalUnavailable : undefined}>{matching === undefined ? t.competition.unavailable : <AnimatedNumber value={project.totalDonated + matching} />}</span>;
}
