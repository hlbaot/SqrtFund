"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { fmt } from "@/lib/copy";
import { shortAddress, formatCount, formatUsdcFull, formatDateTimeGmt7 } from "@/lib/format";
import { CountdownTimer } from "@/components/round/CountdownTimer";
import { AnimatedNumber, CopyAddress, StatusChip, MetricBar } from "@/components/leaderboard/Primitives";
import { displayNumber, type RoundSummary } from "@/components/leaderboard/model";
import { Stat, StatGroup } from "@/components/common/Stat";

export type ViewState = "ready" | "loading" | "error";
export interface RoundsListProps {
  rounds: RoundSummary[];
  state?: ViewState;
  isAdmin?: boolean;
  onRetry?: () => void;
}

export function PresentationState({ state, onRetry, children }: { state: "empty" | "error"; onRetry?: () => void; children?: React.ReactNode }) {
  const { t } = useLocale();
  return <div role={state === "error" ? "alert" : "status"} className="border border-line bg-surface px-5 py-14 text-center">
    {state === "error" ? <><h2 className="text-lg font-semibold">{t.competition.error}</h2><p className="mt-2 text-sm text-muted">{t.competition.errorHint}</p><button type="button" onClick={onRetry} className="competition-action mt-6">{t.competition.retry}</button></> : children}
  </div>;
}

export function RoundListCard({ round, onRetry }: { round: RoundSummary; onRetry?: () => void }) {
  const { t, locale } = useLocale();
  const c = t.competition;
  if (round.readError) return <article role="alert" className="flex min-w-0 flex-col gap-3 border border-line bg-surface p-5 sm:p-6">
    <h2 className="font-semibold break-all">{fmt(c.roundReadError, { address: round.id })}</h2>
    <p className="text-sm text-muted">{round.readError === "version" ? c.versionMismatch : c.roundReadHint}</p>
    {(round.version === "legacy" || round.readError === "version") && <span className="mono-label text-xs text-primary">{c.legacyRound}</span>}
    <button type="button" onClick={onRetry} className="competition-action mt-auto">{c.retry}</button>
  </article>;
  return (
    <article
      className={`relative flex h-full min-w-0 flex-col bg-surface p-5 sm:p-6 ${
        round.phase === "open"
          ? "gradient-border before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:bg-primary"
          : "border border-line"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="tabular-mono text-lg font-bold">
            {fmt(c.round, { n: displayNumber(round.number, locale, 0) })}
          </h2>
          <div className="mt-1 inline-flex items-center text-muted">
            <span className="tabular-mono text-xs" title={round.id}>
              {shortAddress(round.id)}
            </span>
            <CopyAddress address={round.id} />
          </div>
        </div>
        <StatusChip phase={round.phase} />
      </div>

      {round.version === "legacy" && <p className="mt-3 text-xs font-semibold text-primary">{c.legacyRound}</p>}

      {round.name && (
        <p
          className="mt-2 line-clamp-2 text-sm font-medium text-foreground"
          title={round.name}
        >
          {round.name}
        </p>
      )}

      {/* Time rows: label left in label role, value right in mono at the same size */}
      <div className="mt-4 grid gap-2 border-y border-line py-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="role-label shrink-0">{c.start}</span>
          <time
            className="tabular-mono text-xs text-foreground text-right"
            dateTime={round.startTime}
          >
            {formatDateTimeGmt7(round.startTime)}
          </time>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="role-label shrink-0">{c.end}</span>
          <time
            className="tabular-mono text-xs text-foreground text-right"
            dateTime={round.endTime}
          >
            {formatDateTimeGmt7(round.endTime)}
          </time>
        </div>
      </div>

      {/* Matching Pool: single hero metric on the card */}
      <div className="mt-4">
        <p className="role-label text-muted">{c.pool}</p>
        <div className="mt-1 flex items-baseline gap-1.5 text-money">
          <span
            className="value-lg text-money"
            title={formatUsdcFull(round.matchingPool)}
          >
            <AnimatedNumber value={round.matchingPool} decimals={2} />
          </span>
          <span className="role-unit">{c.currency}</span>
        </div>
      </div>

      {round.phase === "open" && (
        <div className="mt-3">
          <CountdownTimer endTime={round.endTime} />
        </div>
      )}

      {/* Stats group: Supporters first (primary tone), Projects, Direct USDC */}
      <StatGroup columns={3} className="my-4">
        <Stat
          label={c.supporters}
          value={<AnimatedNumber value={round.totalSupporters} decimals={0} />}
          tone="primary"
          title={formatCount(round.totalSupporters)}
        />
        <Stat
          label={c.projects}
          value={<AnimatedNumber value={round.projectCount} decimals={0} />}
          tone="default"
          title={formatCount(round.projectCount)}
        />
        <Stat
          label={c.direct}
          value={<AnimatedNumber value={round.totalDonated} decimals={2} />}
          unit="USDC"
          tone="default"
          title={formatUsdcFull(round.totalDonated)}
        />
      </StatGroup>

      {/* Fill any extra vertical space gracefully if sibling cards are taller */}
      <div className="flex-1 min-h-2 mb-3">
        {round.totalSupporters > 0 && (
          <MetricBar
            value={round.totalSupporters}
            max={Math.max(round.totalSupporters, 100)}
          />
        )}
      </div>

      {/* CTA pinned to the bottom */}
      <Link
        href={`/round/${round.id}`}
        className="competition-action mt-auto flex min-h-11 w-full items-center justify-between gap-3"
      >
        <span>{c.viewLeaderboard}</span>
        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>
    </article>
  );
}

export function RoundsList({ rounds, state = "ready", isAdmin, onRetry }: RoundsListProps) {
  const { t, locale } = useLocale();
  const c = t.competition;
  const [filter, setFilter] = useState<"all" | "active" | "ended">("all");
  const counts = { all: rounds.length, active: rounds.filter(r => !r.readError && r.phase === "open").length, ended: rounds.filter(r => !r.readError && (r.phase === "closed" || r.phase === "finalized" || r.phase === "cancelled")).length };
  const visible = useMemo(() => [...rounds].sort((a, b) => b.number - a.number).filter(round => filter === "all" || (!round.readError && (filter === "active" ? round.phase === "open" : ["closed", "finalized", "cancelled"].includes(round.phase)))), [rounds, filter]);
  return <section className="min-w-0 space-y-7" aria-label={c.rounds}>
    <header className="flex flex-col justify-between gap-6 border-b border-line pb-7 xl:flex-row xl:items-end">
      <div className="min-w-0"><span className="mono-label text-xs text-primary">{c.currency} / {c.timezone}</span><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{c.rounds}</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{c.subtitle}</p></div>
      <div role="group" aria-label={c.rounds} className="competition-segment flex max-w-full self-start border border-line bg-bg xl:self-auto">{(["all", "active", "ended"] as const).map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className="competition-focus flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-2 px-3 py-2 text-xs sm:px-5"><span>{c[key]}</span><span className="tabular-mono text-xs text-muted">{state === "loading" ? c.unavailable : displayNumber(counts[key], locale, 0)}</span></button>)}</div>
    </header>
    {state === "error" ? <PresentationState state="error" onRetry={onRetry} /> : state === "loading" ? <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={c.loading}>{[0, 1, 2].map(i => <div key={i} className="competition-skeleton border border-line bg-surface p-6"><div className="h-6 w-1/2 bg-line" /><div className="mt-8 h-14 bg-line" /><div className="mt-8 h-16 bg-line" /><div className="mt-8 h-10 bg-line" /><div className="mt-10 h-11 bg-line" /></div>)}</div> : visible.length ? <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(round => <RoundListCard key={round.id} round={round} onRetry={onRetry} />)}</div> : <PresentationState state="empty"><h2 className="font-semibold">{rounds.length ? c.noFilteredRounds : c.noRounds}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted">{rounds.length ? c.filterHint : c.noRoundsHint}</p>{isAdmin && !rounds.length && <Link href="/admin" className="competition-action mt-6 inline-flex">{c.admin}</Link>}</PresentationState>}
    <span className="sr-only" aria-live="polite">{displayNumber(visible.length, locale, 0)} {c.rounds}</span>
  </section>;
}
