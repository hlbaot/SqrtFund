"use client";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLocale } from "@/lib/context/locale";
import { projectModerationState, type ModerationAction, type ModerationRound } from "@/lib/projectModeration";
import type { ProjectModeration } from "@/lib/projectVisibility";
import { StatusAlert } from "@/components/ui/StatusAlert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { projectReviewCopy } from "@/lib/projectReview";

export function ProjectModerationActions({ project, round, viewer, now, pending, onAction, compact = false }: {
  project: ProjectModeration; round: ModerationRound; viewer?: string; now: number; pending: boolean; onAction: (action: ModerationAction) => void;
  compact?: boolean;
}) {
  const { t, locale } = useLocale(); const c = t.moderation;
  const state = projectModerationState(project, round, viewer, now);
  if (!state.showActions) {
    if (state.reason === "unauthorized" || state.reason === "notPending") return null;
    if (compact) return state.reason === "expired" ? <StatusBadge status="expired">{projectReviewCopy[locale].expired}</StatusBadge> : null;
    return <StatusAlert tone="warning" title={c[state.reason!]} />;
  }
  return <div className={compact ? "shrink-0" : "w-full sm:w-auto sm:min-w-64"}>
    <div className={compact ? "flex items-center gap-1.5" : "flex w-full flex-col gap-2 sm:flex-row sm:justify-end"} role="group" aria-label={c.actions}>
      <span className="w-full sm:w-auto" title={pending ? c.busy : undefined} tabIndex={pending ? 0 : undefined}><Button size="sm" variant="accent" className="min-h-7 h-7 w-full border-money/20 bg-money/5 px-2.5 py-1 font-medium text-[11px]! leading-4! font-sans! normal-case! tracking-normal! text-money/90! enabled:hover:border-money/40 enabled:hover:bg-money/10 focus-visible:ring-2 focus-visible:ring-money/40" disabled={pending} onClick={() => onAction("approve")}><Check className="h-3 w-3" aria-hidden="true" />{t.admin.approveBtn}</Button></span>
      {state.canReject && <span className="w-full sm:w-auto" title={pending ? c.busy : undefined} tabIndex={pending ? 0 : undefined}><Button size="sm" variant="destructive" className="min-h-7 h-7 w-full border-line bg-transparent px-2.5 py-1 font-medium text-[11px]! leading-4! font-sans! normal-case! tracking-normal! text-muted! enabled:hover:border-primary/30 enabled:hover:bg-primary/5 enabled:hover:text-primary! focus-visible:ring-2 focus-visible:ring-primary/40" disabled={pending} onClick={() => onAction("reject")}><X className="h-3 w-3" aria-hidden="true" />{t.rejection.action}</Button></span>}
    </div>
    {!compact && state.reason === "legacy" && <StatusAlert tone="info" className="mt-2" title={c.legacy} />}
  </div>;
}
