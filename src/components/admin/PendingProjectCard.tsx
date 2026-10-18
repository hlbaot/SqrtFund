"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";
import type { Project } from "@/types";
import { useLocale } from "@/lib/context/locale";
import { safeProjectLink, projectModerationState } from "@/lib/projectModeration";
import { projectReviewCopy, projectReviewStatus } from "@/lib/projectReview";
import { StatusAlert } from "@/components/ui/StatusAlert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProjectModerationActions } from "./ProjectModerationActions";

type ActionsProps = Parameters<typeof ProjectModerationActions>[0];
export type ReviewProject = ActionsProps["project"] & Pick<Project, "id" | "name" | "description" | "ownerAddress" | "contactUrl"> & { registeredAt?: string };
export type PendingProjectCardProps = Omit<ActionsProps, "project" | "compact"> & { project: ReviewProject; expanded: boolean; onToggle: () => void };

export function PendingProjectCard({ project, expanded, onToggle, ...actions }: PendingProjectCardProps) {
  const { t, locale } = useLocale();
  const c = projectReviewCopy[locale];
  const detailsId = useId();
  const titleId = useId();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const link = safeProjectLink(project.contactUrl);
  const status = projectReviewStatus(project, actions.round, actions.now);
  const state = projectModerationState(project, actions.round, actions.viewer, actions.now);
  const focus = "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";
  async function copyOwner() {
    try { await navigator.clipboard.writeText(project.ownerAddress); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  }
  const CopyIcon = copyState === "copied" ? Check : Copy;
  const copyButton = <button type="button" onClick={() => void copyOwner()} title={t.common.copyAddress} aria-label={`${t.common.copyAddress}: ${project.ownerAddress}`} className={`shrink-0 p-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 ${focus}`}><CopyIcon className="h-4 w-4" aria-hidden="true" /></button>;

  return <article aria-labelledby={titleId} className="min-w-0 self-start rounded-sm border border-slate-700 bg-slate-950/90 text-sm leading-relaxed text-slate-100">
    <div className="flex min-h-[72px] flex-wrap items-center gap-x-2 gap-y-2 px-3 py-1" onClick={event => { if (!(event.target as Element).closest("button, a")) onToggle(); }}>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={onToggle} className={`min-w-0 flex-1 py-1 text-left ${focus}`}>
          <span className="flex min-w-0 items-center gap-2"><span id={titleId} className="min-w-0 flex-1 truncate font-bold text-slate-100" title={project.name}>{project.name}</span></span>
          <span title={project.ownerAddress} className="block font-mono text-sm text-slate-300">{project.ownerAddress.slice(0, 8)}...{project.ownerAddress.slice(-4)}</span>
        </button>
        {copyButton}
      </div>
      <div className="order-3 flex w-full flex-wrap items-center justify-between gap-2 sm:order-none sm:w-auto sm:flex-col sm:items-end sm:gap-1">
        <span className="max-w-44"><StatusBadge status={status} title={c[`${status}Badge`]}><span className="truncate">{c[`${status}Badge`]}</span></StatusBadge></span>
        <ProjectModerationActions project={project} {...actions} compact />
      </div>
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={detailsId} aria-label={`${expanded ? c.collapse : c.expand}: ${project.name}`} className={`shrink-0 p-2 text-slate-300 hover:bg-slate-800 ${focus}`}><ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></button>
    </div>
    <div id={detailsId} hidden={!expanded} className="space-y-4 border-t border-slate-700 p-4">
      <StatusBadge status={status}>{c[`${status}Badge`]}</StatusBadge>
      {status === "expired" && <StatusAlert tone="warning" clock title={c.ended}>{c.endedDetail}</StatusAlert>}
      {state.reason === "legacy" && <StatusAlert tone="info" title={t.moderation.legacy} />}
      {state.reason && ["finalized", "cancelled", "loading"].includes(state.reason) && <StatusAlert tone="info" title={t.moderation[state.reason]} />}
      <dl className="space-y-4">
        <div><dt className="mb-1 text-sm uppercase tracking-wide text-slate-400">{t.moderation.description}</dt><dd className="whitespace-pre-wrap break-words text-slate-100">{project.description || "—"}</dd></div>
        <div><dt className="mb-1 text-sm uppercase tracking-wide text-slate-400">{t.admin.ownerLabel}</dt><dd className="flex items-start gap-1"><span className="min-w-0 flex-1 break-all font-mono text-slate-100">{project.ownerAddress}</span>{copyButton}</dd></div>
        <div><dt className="mb-1 text-sm uppercase tracking-wide text-slate-400">{t.admin.linkLabel}</dt><dd className="break-all">{link ? <a href={link} target="_blank" rel="noopener noreferrer" className={`inline-flex items-start gap-2 text-blue-200 underline underline-offset-4 hover:text-blue-100 ${focus}`}><span className="min-w-0 break-all">{project.contactUrl}</span><ExternalLink className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /></a> : <span className="text-slate-300">{project.contactUrl || "—"}</span>}</dd></div>
        {project.registeredAt && <div><dt className="mb-1 text-sm uppercase tracking-wide text-slate-400">{c.registered}</dt><dd className="text-slate-100">{project.registeredAt}</dd></div>}
      </dl>
    </div>
    <p className="sr-only" role="status">{copyState === "copied" ? c.copied : copyState === "failed" ? c.copyFailed : ""}</p>
  </article>;
}
