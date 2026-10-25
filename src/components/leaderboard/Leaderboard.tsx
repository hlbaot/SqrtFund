"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { PresentationState, type ViewState } from "@/components/rounds/RoundsList";
import { AnimatedNumber, MetricBar } from "./Primitives";
import { MatchingMetric, ProjectIdentity, RankBadge, TotalMetric } from "./ProjectMetrics";
import { Podium } from "./Podium";
import { Stat } from "@/components/common/Stat";
import { displayNumber, rankProjects, sortProjects, type LeaderboardProject, type LeaderboardSort, type RankedProject } from "./model";

export interface LeaderboardProps {
  projects: LeaderboardProject[];
  roundId: string;
  pool: number;
  finalized: boolean;
  state?: ViewState;
  isAdmin?: boolean;
  wallet?: string;
  onRetry?: () => void;
  cancelled?: boolean;
  canDonate?: boolean;
}

function useValueFlash<T extends HTMLElement>(project: RankedProject) {
  const row = useRef<T>(null);
  const signature = `${project.supporterCount}:${project.totalDonated}:${project.estimatedMatching}:${project.finalMatching}`;
  const previous = useRef(signature);
  useEffect(() => {
    if (previous.current !== signature && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      row.current?.animate([{ backgroundColor: "var(--surface-2)" }, { backgroundColor: "var(--surface)" }], { duration: 650 });
    }
    previous.current = signature;
  }, [signature]);
  return row;
}

function DesktopRow({ project, roundId, pool, finalized, wallet, max }: LeaderboardProps & { project: RankedProject; max: number }) {
  const { t } = useLocale();
  const row = useValueFlash<HTMLTableRowElement>(project);
  return <tr ref={row} data-zero={project.supporterCount === 0} className="competition-row relative h-[134px] bg-surface">
    <td className="px-5 py-5"><RankBadge project={project} /></td>
    <td className="max-w-0 px-4 py-5"><ProjectIdentity project={project} roundId={roundId} wallet={wallet} stretched /></td>
    <td className="px-4 py-5"><div className={`stat-value ${project.supporterCount ? "text-foreground" : "text-muted"}`}><AnimatedNumber value={project.supporterCount} decimals={0} /></div>{project.supporterCount ? <MetricBar value={project.supporterCount} max={max} /> : <p className="mt-1 text-xs text-muted">{t.competition.noSupporters}</p>}</td>
    <td className="stat-value px-4 py-5"><span className="competition-number block"><AnimatedNumber value={project.totalDonated} /></span></td>
    <td className="stat-value px-4 py-5"><MatchingMetric project={project} finalized={finalized} pool={pool} /></td>
    <td className="stat-value px-5 py-5"><TotalMetric project={project} finalized={finalized} /></td>
  </tr>;
}

function MobileRow({ project, roundId, pool, finalized, cancelled, canDonate, wallet, max, top }: LeaderboardProps & { project: RankedProject; max: number; top: boolean }) {
  const { t } = useLocale();
  const row = useValueFlash<HTMLDivElement>(project);
  const c = t.competition;
  return (
    <div
      ref={row}
      data-zero={project.supporterCount === 0}
      className={`relative min-w-0 bg-surface p-4 ${
        project.supporterRank === 1 ? "gradient-border" : "border border-line"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="shrink-0 pt-1">
          <RankBadge project={project} large={top} />
        </span>
        <div className="min-w-0 flex-1">
          <ProjectIdentity project={project} roundId={roundId} wallet={wallet} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-line py-4">
        <Stat
          label={c.supporters}
          value={<AnimatedNumber value={project.supporterCount} decimals={0} />}
          tone={project.supporterCount ? "primary" : "muted"}
        />
        <Stat
          label={c.direct}
          unit={c.currency}
          value={<AnimatedNumber value={project.totalDonated} decimals={2} />}
          tone="default"
        />
        <Stat
          label={c.matching}
          unit={c.currency}
          value={<MatchingMetric project={project} finalized={finalized} pool={pool} bar={false} />}
          tone="money"
        />
        <Stat
          label={c.total}
          unit={c.currency}
          value={<TotalMetric project={project} finalized={finalized} />}
          tone="default"
        />
      </div>

      <div className="my-4">
        {project.supporterCount ? (
          <MetricBar value={project.supporterCount} max={max} />
        ) : (
          <p className="text-xs text-muted">{c.noSupporters}</p>
        )}
      </div>

      {!finalized && !cancelled && canDonate !== false && <Link
        href={`/round/${roundId}/project/${project.id}`}
        className="mono-label flex min-h-10 w-full items-center justify-center gap-1.5 border border-money text-money bg-money/5 hover:bg-money/15 py-2 px-3 text-xs font-semibold cursor-pointer transition-all active:scale-[0.99] rounded-xs"
      >
        {c.donateToMe}
      </Link>}
    </div>
  );
}

export function Leaderboard(props: LeaderboardProps) {
  const { projects, roundId, pool, finalized, state = "ready", isAdmin, onRetry, cancelled } = props;
  const { t, locale } = useLocale();
  const c = t.competition;
  const [sort, setSort] = useState<LeaderboardSort>("supporters");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const ranked = useMemo(() => rankProjects(projects), [projects]);
  const rows = useMemo(() => sortProjects(ranked, sort, finalized).filter(project => (project.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) || project.shortDescription.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && (category === "all" || project.category === category)), [ranked, sort, finalized, search, category]);
  const max = Math.max(0, ...ranked.map(project => project.supporterCount));
  const columns = [{ key: "rank", label: c.rank }, { key: "project", label: c.project }, { key: "supporters", label: c.supporters }, { key: "direct", label: `${c.direct} · ${c.currency}` }, { key: "matching", label: `${c.matching} · ${c.currency}` }, { key: "total", label: `${c.total} · ${c.currency}` }];
  if (state === "error") return <PresentationState state="error" onRetry={onRetry} />;
  if (state === "loading") return <LeaderboardSkeleton />;
  if (!ranked.length) return <PresentationState state="empty"><h2 className="font-semibold">{c.noProjects}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted">{isAdmin ? c.adminHint : c.noProjectsHint}</p>{!cancelled && <Link href={isAdmin ? "/admin" : `/register?round=${encodeURIComponent(roundId)}`} className="competition-action mt-6 inline-flex">{isAdmin ? c.admin : c.register}</Link>}</PresentationState>;
  return <div className="min-w-0 space-y-8">
    <Podium
      projects={ranked}
      roundId={roundId}
      pool={pool}
      finalized={finalized}
      canDonate={props.canDonate !== undefined ? props.canDonate : (!cancelled && !finalized)}
    />
    <section aria-label={c.leaderboard} className="min-w-0 space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center"><h2 className="text-xl font-bold">{c.leaderboard} <span className="tabular-mono text-sm font-normal text-muted">/ {displayNumber(ranked.length, locale, 0)}</span></h2><div role="group" aria-label={c.leaderboard} className="competition-segment flex max-w-full flex-wrap self-start border border-line bg-bg">{(["supporters", "direct", "matching"] as const).map(key => <button type="button" key={key} aria-pressed={sort === key} onClick={() => setSort(key)} className="competition-focus min-h-11 px-3 py-2 text-xs">{key === "supporters" ? c.sortSupporters : key === "direct" ? c.sortDirect : c.sortMatching}</button>)}</div></div>
      <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><span className="sr-only">{c.search}</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input className="competition-focus min-h-11 w-full border border-line bg-bg py-2 pl-10 pr-3 text-sm" value={search} onChange={event => setSearch(event.target.value)} placeholder={c.search} /></label><select value={category} aria-label={c.categories} onChange={event => setCategory(event.target.value)} className="competition-focus min-h-11 max-w-full border border-line bg-bg px-3 text-xs"><option value="all">{c.categories}</option>{(["technology", "education", "environment", "arts"] as const).map(key => <option key={key} value={key}>{c[key]}</option>)}</select></div>
      {!rows.length ? <PresentationState state="empty"><h3>{c.noMatches}</h3><button className="competition-action mt-5" onClick={() => { setSearch(""); setCategory("all"); }}>{c.clear}</button></PresentationState> : <>
        <div className="competition-scroll hidden max-h-[70vh] min-w-0 overflow-auto border border-line md:block" tabIndex={0} role="region" aria-label={c.leaderboard}>
          <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-0 text-left"><caption className="sr-only">{c.leaderboard}</caption><colgroup>{["9%", "27%", "17%", "15%", "17%", "15%"].map((width, index) => <col key={index} style={{ width }} />)}</colgroup><thead className="sticky top-0 z-20 bg-bg"><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={column.key === sort ? "descending" : undefined} className="role-label border-b border-line px-4 py-4 text-left font-medium text-muted">{column.label}</th>)}</tr></thead><tbody>{rows.map(project => <DesktopRow key={project.id} {...props} project={project} max={max} />)}</tbody></table>
        </div>
        <div className="grid gap-4 md:hidden">{rows.map((project, index) => <MobileRow key={project.id} {...props} project={project} max={max} top={index < 3} />)}</div>
      </>}
      <span className="sr-only" aria-live="polite">{displayNumber(rows.length, locale, 0)} {c.projects}</span>
    </section>
  </div>;
}

export function LeaderboardSkeleton() {
  const { t } = useLocale();
  return <div role="status" aria-label={t.competition.loading} className="space-y-6"><div className="hidden grid-cols-3 gap-4 lg:grid">{[0, 1, 2].map(i => <div key={i} className="competition-skeleton h-[540px] border border-line bg-surface p-6"><div className="h-12 w-1/3 bg-line" /><div className="mt-8 h-12 bg-line" /><div className="mt-8 h-20 bg-line" /><div className="mt-8 h-16 bg-line" /></div>)}</div><div className="h-12 border border-line bg-surface" /><div className="hidden border border-line md:block">{[0, 1, 2, 3].map(i => <div key={i} className="competition-skeleton flex h-[134px] items-center gap-5 border-b border-line bg-surface p-5"><div className="h-10 w-12 bg-line" /><div className="h-12 flex-1 bg-line" /><div className="h-10 w-1/3 bg-line" /></div>)}</div><div className="grid gap-4 md:hidden">{[0, 1, 2].map(i => <div key={i} className="competition-skeleton h-[350px] border border-line bg-surface p-4"><div className="h-12 bg-line" /><div className="mt-5 h-36 bg-line" /><div className="mt-8 h-11 bg-line" /></div>)}</div></div>;
}
