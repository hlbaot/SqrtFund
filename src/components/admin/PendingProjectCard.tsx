"use client";

import { CATEGORY_LABELS, CATEGORY_GUIDANCE, isFundingCategory } from "@/lib/projectCategories";
import type { ProjectCategory } from "@/types";
import { ReviewOutcomePanel } from "@/components/policy/ReviewOutcomePanel";
import type { Address } from "viem";
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
export type ReviewProject = ActionsProps["project"] & Pick<Project, "id" | "name" | "ownerName" | "description" | "ownerAddress" | "contactUrl"> & { registeredAt?: string; roundId?: string; category?: ProjectCategory };
export type PendingProjectCardProps = Omit<ActionsProps, "project" | "compact"> & { project: ReviewProject; expanded: boolean; onToggle: () => void };

export function WalletAddressCopy({ address }: { address: string }) {
  const { t, locale } = useLocale();
  const c = projectReviewCopy[locale];
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const focus = "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  async function copyOwner(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const CopyIcon = copyState === "copied" ? Check : Copy;
  const short = address ? `${address.slice(0, 8)}...${address.slice(-4)}` : "";

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span
        title={address}
        className="truncate font-mono text-[11px] text-muted cursor-help"
      >
        {short}
      </span>
      <button
        type="button"
        onClick={copyOwner}
        title={t.common.copyAddress}
        aria-label={`${t.common.copyAddress}: ${address}`}
        className={`shrink-0 p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground cursor-pointer active:scale-95 ${focus}`}
      >
        <CopyIcon className="h-3 w-3" aria-hidden="true" />
      </button>
      <span className="sr-only" role="status">
        {copyState === "copied" ? c.copied : copyState === "failed" ? c.copyFailed : ""}
      </span>
    </div>
  );
}

export function PendingProjectCard({ project, expanded, onToggle, ...actions }: PendingProjectCardProps) {
  const { t, locale } = useLocale();
  const c = projectReviewCopy[locale];
  const detailsId = useId();
  const titleId = useId();
  const link = safeProjectLink(project.contactUrl);
  const status = projectReviewStatus(project, actions.round, actions.now);
  const state = projectModerationState(project, actions.round, actions.viewer, actions.now);
  const focus = "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

  return <article aria-labelledby={titleId} className="min-w-0 self-start rounded-sm border border-line bg-surface-2/30 text-xs leading-relaxed text-foreground transition-colors hover:border-line-strong">
    <div className="cursor-pointer space-y-3 rounded-sm p-3.5 transition-colors hover:bg-surface-2/60" onClick={event => { if (!(event.target as Element).closest("button, a")) onToggle(); }}>
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={onToggle} className={`min-w-0 flex-1 text-left transition-colors hover:text-primary cursor-pointer ${focus}`}>
          <span id={titleId} className="block truncate text-[13px] font-medium tracking-tight" title={project.name}>{project.name}</span>
        </button>
        <span className="max-w-[45%]"><StatusBadge status={status} title={c[`${status}Badge`]}><span className="truncate">{c[`${status}Badge`]}</span></StatusBadge></span>
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={detailsId} aria-label={`${expanded ? c.collapse : c.expand}: ${project.name}`} className={`shrink-0 p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground cursor-pointer active:scale-95 ${focus}`}><ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" /></button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <WalletAddressCopy address={project.ownerAddress} />
        <ProjectModerationActions project={project} {...actions} compact />
      </div>
    </div>
    <div id={detailsId} hidden={!expanded} className="space-y-4 border-t border-line p-4">
      <StatusBadge status={status}>{c[`${status}Badge`]}</StatusBadge>
      {status === "expired" && <StatusAlert tone="warning" clock title={c.ended}>{c.endedDetail}</StatusAlert>}
      {state.reason === "legacy" && <StatusAlert tone="info" title={t.moderation.legacy} />}
      {state.reason && ["finalized", "cancelled", "loading"].includes(state.reason) && <StatusAlert tone="info" title={t.moderation[state.reason]} />}
      {expanded && project.roundId && <ReviewOutcomePanel roundAddress={project.roundId as Address} projectId={project.id} approved={project.approved} rejected={project.rejected} />}
      <div className="space-y-1"><p className="text-xs font-semibold">{CATEGORY_LABELS[locale][project.category ?? "uncategorized"]}</p>{isFundingCategory(project.category) && <p className="text-xs text-muted">{CATEGORY_GUIDANCE[locale][project.category]}</p>}</div>
      <dl className="space-y-4">
        <div><dt className="mb-1 text-[10px] font-medium text-muted">{t.moderation.description}</dt><dd className="whitespace-pre-wrap break-words text-foreground">{project.description || "—"}</dd></div>
        <div>
          <dt className="mb-1 text-[10px] font-medium text-muted">{t.admin.ownerLabel}</dt>
          <dd className="space-y-0.5">
            {project.ownerName ? (
              <>
                <span className="block truncate text-xs font-medium text-foreground" title={project.ownerName}>
                  {project.ownerName}
                </span>
                <WalletAddressCopy address={project.ownerAddress} />
              </>
            ) : (
              <WalletAddressCopy address={project.ownerAddress} />
            )}
          </dd>
        </div>
        <div><dt className="mb-1 text-[10px] font-medium text-muted">{t.admin.linkLabel}</dt><dd className="break-all">{link ? <a href={link} target="_blank" rel="noopener noreferrer" className={`inline-flex items-start gap-2 text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary ${focus}`}><span className="min-w-0 break-all">{project.contactUrl}</span><ExternalLink className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /></a> : <span className="text-muted">{project.contactUrl || "—"}</span>}</dd></div>
        {project.registeredAt && <div><dt className="mb-1 text-[10px] font-medium text-muted">{c.registered}</dt><dd className="text-foreground">{project.registeredAt}</dd></div>}
      </dl>
    </div>
  </article>;
}
