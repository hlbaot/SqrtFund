"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/common/Pagination";
import { paginateRounds, parsePage, ROUNDS_GRID, ROUNDS_PAGE_SIZE, type RoundFilter } from "./pagination";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { fmt } from "@/lib/copy";
import { shortAddress, formatCount, formatUsdcFull, formatDateTimeGmt7 } from "@/lib/format";
import { ExplorerLink } from "@/components/tx/ExplorerLink";
import { CountdownTimer } from "@/components/round/CountdownTimer";
import { AnimatedNumber, CopyAddress, StatusChip, MetricBar } from "@/components/leaderboard/Primitives";
import { displayNumber, type RoundSummary } from "@/components/leaderboard/model";
import { Stat, StatGroup } from "@/components/common/Stat";

export type ViewState = "ready" | "loading" | "error";
export interface RoundsListProps {
  rounds: RoundSummary[];
  state?: ViewState;
  isAdmin?: boolean;
  paginationReady?: boolean;
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
    <ExplorerLink address={round.id} label={t.onChain.roundContract} />
    <button type="button" onClick={onRetry} className="competition-action mt-auto">{c.retry}</button>
  </article>;

  const roundNumberLabel = fmt(c.round, { n: displayNumber(round.number, locale, 0) });
  const hasName = Boolean(round.name && round.name.trim().length > 0);
  const displayTitle = hasName ? round.name!.trim() : roundNumberLabel;
  const organizer = round.organizer && round.organizer.trim().length > 0 ? round.organizer.trim() : null;

  return (
    <article
      className={`round-list-card relative flex h-full min-w-0 flex-col bg-surface p-5 sm:p-6 ${
        round.phase === "open"
          ? "gradient-border before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:bg-primary"
          : "border border-line"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-bold text-foreground break-words line-clamp-2" title={displayTitle}>
              {displayTitle}
            </h2>
            {hasName && (
              <span className="mono-label text-xs text-muted shrink-0">
                ({roundNumberLabel})
              </span>
            )}
          </div>
          <div className="mt-1 inline-flex items-center text-muted">
            <span className="tabular-mono text-xs" title={round.id}>
              {shortAddress(round.id)}
            </span>
            <CopyAddress address={round.id} />
            <ExplorerLink address={round.id} iconOnly label={t.onChain.roundContract} />
          </div>
        </div>
        <StatusChip phase={round.phase} />
      </div>

      {round.version === "legacy" && <p className="mt-3 text-xs font-semibold text-primary">{c.legacyRound}</p>}

      {organizer && (
        <p
          className="mt-2 line-clamp-1 text-xs text-muted"
          title={organizer}
        >
          {organizer}
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

function RoundSkeletons() {
  const { t } = useLocale();
  return <div className={ROUNDS_GRID} role="status" aria-label={t.competition.loading}>{Array.from({ length: ROUNDS_PAGE_SIZE }, (_, i) => <div key={i} className="competition-skeleton border border-line bg-surface p-6"><div className="h-6 w-1/2 bg-line" /><div className="mt-8 h-14 bg-line" /><div className="mt-8 h-16 bg-line" /><div className="mt-8 h-10 bg-line" /><div className="mt-10 h-11 bg-line" /></div>)}</div>;
}

export function RoundsList(props: RoundsListProps) {
  return <Suspense fallback={<RoundSkeletons />}><PaginatedRoundsList {...props} /></Suspense>;
}

function PaginatedRoundsList({ rounds, state = "ready", isAdmin, onRetry, paginationReady = true }: RoundsListProps) {
  const { t, locale } = useLocale();
  const c = t.competition;
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<RoundFilter>("all");
  const sectionRef = useRef<HTMLElement>(null);
  const resultsId = useId();
  const requestedPage = parsePage(searchParams.get("page"));
  const visible = paginateRounds(rounds, filter, requestedPage);
  const previousPage = useRef(requestedPage);
  const writePage = (page: number, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(page));
    window.history[replace ? "replaceState" : "pushState"](null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  // Wait for all discovery reads before normalizing a shared URL; partial realtime
  // snapshots may temporarily contain fewer pages than the completed list.
  useEffect(() => {
    if (state === "ready" && paginationReady && (requestedPage !== visible.page || (searchParams.has("page") && searchParams.get("page") !== String(visible.page)))) writePage(visible.page, true);
  }, [requestedPage, visible.page, state, paginationReady, searchParams]);
  useEffect(() => {
    if (previousPage.current !== requestedPage) {
      sectionRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      previousPage.current = requestedPage;
    }
  }, [requestedPage]);
  const counts = { all: rounds.length, active: rounds.filter(r => !r.readError && r.phase === "open").length, ended: rounds.filter(r => !r.readError && (r.phase === "closed" || r.phase === "finalized" || r.phase === "cancelled")).length };
  return <section ref={sectionRef} className="min-w-0 space-y-7 scroll-mt-24" aria-label={c.rounds}>
    <header className="flex flex-col justify-between gap-6 border-b border-line pb-7 xl:flex-row xl:items-end">
      <div className="min-w-0"><span className="mono-label text-xs text-primary">{c.currency} / {c.timezone}</span><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{c.rounds}</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{c.subtitle}</p></div>
      <div role="group" aria-label={c.rounds} className="competition-segment flex max-w-full self-start border border-line bg-bg xl:self-auto">{(["all", "active", "ended"] as const).map(key => <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); writePage(1, true); }} aria-controls={resultsId} className="competition-focus flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-2 px-3 py-2 text-xs sm:px-5"><span>{c[key]}</span><span className="tabular-mono text-xs text-muted">{state === "loading" ? c.unavailable : displayNumber(counts[key], locale, 0)}</span></button>)}</div>
    </header>
    {state === "error" ? <PresentationState state="error" onRetry={onRetry} /> : state === "loading" ? <RoundSkeletons /> : visible.total ? <div id={resultsId} className={ROUNDS_GRID}>{visible.rounds.map(round => <RoundListCard key={round.id} round={round} onRetry={onRetry} />)}</div> : <PresentationState state="empty"><h2 className="font-semibold">{rounds.length ? c.noFilteredRounds : c.noRounds}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted">{rounds.length ? c.filterHint : c.noRoundsHint}</p>{isAdmin && !rounds.length && <Link href="/admin" className="competition-action mt-6 inline-flex">{c.admin}</Link>}</PresentationState>}
    {state === "ready" && <Pagination page={visible.page} pageSize={ROUNDS_PAGE_SIZE} total={visible.total} onPageChange={page => writePage(page)} controls={resultsId} label={locale === "vi" ? "Phân trang round" : "Rounds pagination"} />}
    <span className="sr-only" aria-live="polite">{displayNumber(visible.total, locale, 0)} {c.rounds}</span>
  </section>;
}
