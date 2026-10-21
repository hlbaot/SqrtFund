import type { ReactNode } from "react";

export type ProjectReviewStatus = "pending" | "expired" | "approved" | "rejected";
const styles: Record<ProjectReviewStatus, string> = {
  pending: "border-amber-400/15 bg-amber-400/5 text-amber-200/80",
  expired: "border-line bg-surface-2 text-muted",
  approved: "border-money/15 bg-money/5 text-money/80",
  rejected: "border-primary/15 bg-primary/5 text-primary/80",
};
export function StatusBadge({ status, children, title }: { status: ProjectReviewStatus; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex max-w-full items-center rounded-sm border px-2 py-0.5 text-[10px] font-medium leading-4 ${styles[status]}`}>{children}</span>;
}
