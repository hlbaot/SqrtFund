import { CircleCheck, CircleAlert, Clock3, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export type StatusTone = "info" | "warning" | "error" | "success";
const styles: Record<StatusTone, string> = {
  info: "border-blue-500/30 border-l-blue-400 bg-blue-500/10 text-blue-100",
  warning: "border-amber-500/30 border-l-amber-400 bg-amber-500/10 text-amber-100",
  error: "border-red-500/30 border-l-red-400 bg-red-500/10 text-red-100",
  success: "border-emerald-500/30 border-l-emerald-400 bg-emerald-500/10 text-emerald-100",
};
const descriptionStyles: Record<StatusTone, string> = { info: "text-blue-200", warning: "text-amber-200/80", error: "text-red-200", success: "text-emerald-200" };

export function StatusAlert({ tone = "info", title, children, clock = false, className }: {
  tone?: StatusTone; title: string; children?: ReactNode; clock?: boolean; className?: string;
}) {
  const Icon = clock ? Clock3 : { info: Info, warning: TriangleAlert, error: CircleAlert, success: CircleCheck }[tone];
  return <div role="status" className={twMerge(`flex w-full items-start gap-3 rounded-sm border border-l-[3px] p-3 text-sm leading-relaxed ${styles[tone]}`, className)}>
    <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
    <div className="min-w-0"><p className="font-semibold">{title}</p>{children && <div className={`mt-1 ${descriptionStyles[tone]}`}>{children}</div>}</div>
  </div>;
}
