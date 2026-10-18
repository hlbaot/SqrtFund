"use client";

import { useId, useState } from "react";
import { Inbox, Search } from "lucide-react";
import { useLocale } from "@/lib/context/locale";
import { filterReviewProjects, projectReviewCopy, projectReviewStatus, type ReviewFilter } from "@/lib/projectReview";
import { PendingProjectCard, type PendingProjectCardProps, type ReviewProject } from "./PendingProjectCard";
import { StatusAlert } from "@/components/ui/StatusAlert";

type ReviewListProps = Omit<PendingProjectCardProps, "project" | "expanded" | "onToggle" | "onAction"> & {
  projects: ReviewProject[]; isLoading: boolean; isError?: boolean; onRetry?: () => void;
  onAction: (project: ReviewProject, action: "approve" | "reject") => void;
};

/** The scroll region preserves the surrounding admin controls even with 50 records. */
export function ProjectReviewList({ projects, isLoading, isError, onRetry, ...actions }: ReviewListProps) {
  const { t, locale } = useLocale();
  const c = projectReviewCopy[locale];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const searchId = useId();
  const filterId = useId();
  const resultsId = useId();
  const filtered = filterReviewProjects(projects, query, filter, actions.round, actions.now);
  const options: ReviewFilter[] = ["all", "pending", ...(["approved", "rejected", "expired"] as const).filter(status => projects.some(project => projectReviewStatus(project, actions.round, actions.now) === status) || filter === status)];
  const inputStyle = "min-h-10 rounded-sm border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
  return <section aria-label={t.admin.projectsQueueTitle} className="space-y-4 border border-line bg-surface p-4 sm:p-6">
    <h2 className="text-base font-bold text-slate-100">{t.admin.projectsQueueTitle}</h2>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1"><label htmlFor={searchId} className="mb-1 block text-sm text-slate-300">{c.search}</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" /><input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} aria-controls={resultsId} className={`${inputStyle} w-full pl-9`} /></div></div>
      <div><label htmlFor={filterId} className="mb-1 block text-sm text-slate-300">{c.filter}</label><select id={filterId} value={filter} onChange={event => setFilter(event.target.value as ReviewFilter)} aria-controls={resultsId} className={`${inputStyle} w-full sm:min-w-44`}>{options.map(option => <option key={option} value={option}>{c[option]}</option>)}</select></div>
    </div>
    <p aria-live="polite" className="text-sm text-slate-300">{isLoading ? c.loading : c.count.replace("{shown}", String(filtered.length)).replace("{total}", String(projects.length))}</p>
    {isError ? <StatusAlert tone="error" title={c.readError}>{onRetry && <button type="button" onClick={onRetry} className="rounded-sm font-semibold underline focus-visible:outline focus-visible:outline-blue-400">{c.retry}</button>}</StatusAlert> : <ProjectReviewResults id={resultsId} projects={filtered} isLoading={isLoading} isFiltered={Boolean(query.trim()) || filter !== "all"} expanded={expanded} onToggle={id => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; })} {...actions} />}
  </section>;
}

export function ProjectReviewResults({ id, projects, isLoading, isFiltered, expanded, onToggle, onAction, ...actions }: Omit<ReviewListProps, "isError" | "onRetry"> & {
  id?: string; isFiltered: boolean; expanded: ReadonlySet<string>; onToggle: (id: string) => void;
}) {
  const { locale } = useLocale(); const c = projectReviewCopy[locale];
  return <div id={id} role="region" tabIndex={0} aria-label={c.list} aria-busy={isLoading} className="max-h-[70vh] overflow-y-auto overscroll-contain rounded-sm p-1 [scrollbar-width:thin] [scrollbar-color:#475569_#020617] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
    {isLoading ? <div className="grid items-start gap-3 lg:grid-cols-2" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex h-[72px] animate-pulse items-center gap-3 rounded-sm border border-slate-700 bg-slate-950 px-3"><div className="flex-1 space-y-2"><div className="h-4 w-2/3 rounded bg-slate-700" /><div className="h-3 w-1/2 rounded bg-slate-800" /></div><div className="h-7 w-20 rounded bg-slate-800" /></div>)}</div>
      : projects.length === 0 ? <div role="status" className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-slate-600 p-6 text-center text-sm text-slate-300"><Inbox className="h-7 w-7 text-slate-400" aria-hidden="true" /><p>{isFiltered ? c.noResults : c.empty}</p></div>
        : <div className="grid items-start gap-3 lg:grid-cols-2">{projects.map(project => <PendingProjectCard key={project.id} project={project} expanded={expanded.has(project.id)} onToggle={() => onToggle(project.id)} {...actions} onAction={action => onAction(project, action)} />)}</div>}
  </div>;
}
