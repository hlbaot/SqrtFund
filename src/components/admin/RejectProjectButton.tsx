"use client";
import { canRejectProject, canShowRejectProject, type ProjectModeration } from "@/lib/projectVisibility";
import { useLocale } from "@/lib/context/locale";
import { Button } from "@/components/ui/Button";

export function RejectProjectButton({ project, round, viewer, pending, processing = false, onClick }: {
  project: ProjectModeration;
  round: Parameters<typeof canRejectProject>[1];
  viewer?: string;
  pending: boolean;
  processing?: boolean;
  onClick: () => void;
}) {
  const { t } = useLocale();
  if (!canShowRejectProject(project, round, viewer)) return null;
  const available = canRejectProject(project, round, viewer);
  return <span className="inline-flex flex-col items-end gap-1">
    <Button variant="destructive" size="sm" disabled={pending || !available} isLoading={processing}
      title={!round.supportsRejection ? t.rejection.upgrade : undefined} onClick={onClick} className="h-8 text-xs font-bold">{t.rejection.action}</Button>
    {!round.supportsRejection && <span role="status" className="max-w-64 text-right text-xs text-muted">{t.rejection.unavailable}</span>}
  </span>;
}
