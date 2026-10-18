import type { ReactNode } from "react";

export type ProjectReviewStatus = "pending" | "expired" | "approved" | "rejected";
const styles: Record<ProjectReviewStatus, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  expired: "border-slate-500/50 bg-slate-800 text-slate-200",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  rejected: "border-red-400/40 bg-red-400/10 text-red-200",
};
export function StatusBadge({ status, children, title }: { status: ProjectReviewStatus; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex max-w-full items-center rounded-sm border px-2 py-0.5 text-sm font-semibold leading-5 ${styles[status]}`}>{children}</span>;
}
