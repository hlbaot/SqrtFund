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
  return <div className={compact ? "w-full sm:w-auto" : "w-full sm:w-auto sm:min-w-64"}>
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end" role="group" aria-label={c.actions}>
      <span className="w-full sm:w-auto" title={pending ? c.busy : undefined} tabIndex={pending ? 0 : undefined}><Button size="sm" variant="accent" className="h-8 w-full font-bold text-sm! leading-5! font-sans! normal-case! tracking-normal! text-emerald-200! enabled:hover:bg-emerald-900! focus-visible:ring-2 focus-visible:ring-blue-400" disabled={pending} onClick={() => onAction("approve")}><Check className="h-4 w-4" aria-hidden="true" />{t.admin.approveBtn}</Button></span>
      {state.canReject && <span className="w-full sm:w-auto" title={pending ? c.busy : undefined} tabIndex={pending ? 0 : undefined}><Button size="sm" variant="destructive" className="h-8 w-full bg-transparent font-bold text-sm! leading-5! font-sans! normal-case! tracking-normal! text-red-200! enabled:hover:bg-red-900! focus-visible:ring-2 focus-visible:ring-blue-400" disabled={pending} onClick={() => onAction("reject")}><X className="h-4 w-4" aria-hidden="true" />{t.rejection.action}</Button></span>}
    </div>
    {!compact && state.reason === "legacy" && <StatusAlert tone="info" className="mt-2" title={c.legacy} />}
  </div>;
}
