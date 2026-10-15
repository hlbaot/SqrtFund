"use client";

import Link from "next/link";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { fmt } from "@/lib/copy";
import { shortAddress, formatCount, formatUsdcFull, formatDateTimeGmt7 } from "@/lib/format";
import { CountdownTimer } from "@/components/round/CountdownTimer";
import { AnimatedNumber, CopyAddress, InfoTooltip, StatusChip } from "./Primitives";
import { displayNumber, type RoundPhase, type RoundSummary } from "./model";
import { Stat, StatGroup } from "@/components/common/Stat";

export interface RoundChoice { id: string; number: number; phase?: RoundPhase }
export function RoundHeader({ round, choices, onRoundChange, finalPayoutsAvailable = true }: { round: RoundSummary; choices: RoundChoice[]; onRoundChange: (id: string) => void; finalPayoutsAvailable?: boolean }) {
  const { t, locale } = useLocale();
  const c = t.competition;
  const index = choices.findIndex(choice => choice.id.toLowerCase() === round.id.toLowerCase());
  const finalized = round.phase === "finalized";
  const title = fmt(c.round, { n: displayNumber(round.number, locale, 0) });

  return (
    <header className="min-w-0 space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 lg:flex-row lg:items-center">
        <nav aria-label={c.rounds} className="flex min-w-0 flex-wrap items-center gap-3 text-xs">
          <Link href="/rounds" className="competition-focus text-muted hover:text-foreground">
            {c.rounds}
          </Link>
          <span aria-hidden="true" className="text-line-strong">/</span>
          <span className="tabular-mono" aria-current="page">{title}</span>
        </nav>
        <div className="flex min-w-0 max-w-full items-stretch self-start border border-line bg-bg lg:self-auto">
          <button
            type="button"
            aria-label={c.previous}
            disabled={index <= 0}
            onClick={() => onRoundChange(choices[index - 1].id)}
            className="competition-focus flex min-h-11 w-11 shrink-0 items-center justify-center border-r border-line disabled:text-line-strong"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            aria-label={c.switchRound}
            value={round.id}
            onChange={event => onRoundChange(event.target.value)}
            className="competition-focus min-h-11 min-w-0 max-w-[min(65vw,22rem)] flex-1 truncate bg-bg px-3 text-xs"
          >
            {choices.map(choice => (
              <option key={choice.id} value={choice.id}>
                {fmt(c.round, { n: displayNumber(choice.number, locale, 0) })} · {choice.phase ? c[choice.phase] : c.unavailable}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={c.next}
            disabled={index < 0 || index >= choices.length - 1}
            onClick={() => onRoundChange(choices[index + 1].id)}
            className="competition-focus flex min-h-11 w-11 shrink-0 items-center justify-center border-l border-line disabled:text-line-strong"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <StatusChip phase={round.phase} />
          </div>
          {round.name && (
            <p className="mt-2 line-clamp-2 text-sm text-muted" title={round.name}>
              {round.name}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1 text-muted">
            <span className="tabular-mono text-xs" title={round.id}>
              {shortAddress(round.id)}
            </span>
            <CopyAddress address={round.id} />
          </div>
        </div>

        <div className="max-w-full text-xs text-muted">
          {round.phase === "open" ? (
            <CountdownTimer endTime={round.endTime} />
          ) : (
            <div className="space-y-1">
              <p className="role-label">
                {round.phase === "upcoming" ? c.start : c.end}
              </p>
              <time
                className="tabular-mono block text-xs text-foreground"
                dateTime={round.phase === "upcoming" ? round.startTime : round.endTime}
              >
                {formatDateTimeGmt7(round.phase === "upcoming" ? round.startTime : round.endTime)}
              </time>
            </div>
          )}
        </div>
      </div>

      {/* Round header stats strip: Supporters (primary) first, Pool, Direct, Projects */}
      <StatGroup columns={4} className="bg-surface p-4 sm:p-5">
        <Stat
          label={
            <span className="inline-flex items-center">
              <span>{c.votes}</span>
              <InfoTooltip label={`${c.votes}: ${c.metricsInfo}`}>{c.votesInfo}</InfoTooltip>
            </span>
          }
          value={<AnimatedNumber value={round.totalSupporters} decimals={0} />}
          tone="primary"
          title={formatCount(round.totalSupporters)}
        />
        <Stat
          label={
            <span className="inline-flex items-center">
              <span>{c.pool}</span>
              <InfoTooltip label={`${c.pool}: ${c.metricsInfo}`}>{c.matchingInfo}</InfoTooltip>
            </span>
          }
          value={<AnimatedNumber value={round.matchingPool} decimals={2} />}
          unit={c.currency}
          tone="money"
          title={formatUsdcFull(round.matchingPool)}
        />
        <Stat
          label={
            <span className="inline-flex items-center">
              <span>{c.direct}</span>
              <InfoTooltip label={`${c.direct}: ${c.metricsInfo}`}>{c.directInfo}</InfoTooltip>
            </span>
          }
          value={<AnimatedNumber value={round.totalDonated} decimals={2} />}
          unit={c.currency}
          tone="default"
          title={formatUsdcFull(round.totalDonated)}
        />
        <Stat
          label={c.projects}
          value={<AnimatedNumber value={round.projectCount} decimals={0} />}
          tone="default"
          title={formatCount(round.projectCount)}
        />
      </StatGroup>

      <div className="flex flex-col items-start justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-center" aria-live="polite">
        <div className={`inline-flex shrink-0 items-center gap-2 border px-2.5 py-1.5 text-xs ${finalized ? "border-money/40 bg-money/10 text-money" : "border-primary/40 bg-primary/10 text-primary"}`}>
          {finalized ? <Check className="h-3 w-3 text-money" aria-hidden="true" /> : <span className="h-1.5 w-1.5 bg-primary" aria-hidden="true" />}
          {finalized ? c.final : c.live}
        </div>
        <p className="max-w-xl text-xs leading-relaxed text-muted">
          {finalized ? c.finalNote : c.rankingNote}
        </p>
      </div>

      {finalized && !finalPayoutsAvailable && (
        <p className="border-l-2 border-primary pl-3 text-xs leading-relaxed text-muted">
          {c.finalUnavailable}
        </p>
      )}
    </header>
  );
}
