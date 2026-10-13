import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type StatusTone = "neutral" | "success" | "danger" | "warning" | "pending";

export interface StatusChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
}

export function StatusChip({
  tone = "neutral",
  className,
  children,
  ...props
}: StatusChipProps) {
  const toneClass: Record<StatusTone, string> = {
    neutral: "border-line-strong text-muted",
    success: "border-money/50 text-money",
    danger: "border-primary/60 text-primary",
    warning: "border-amber-400/50 text-amber-300",
    pending: "border-line-strong text-muted",
  };

  const dotClass: Record<StatusTone, string> = {
    neutral: "bg-muted",
    success: "bg-money",
    danger: "bg-primary",
    warning: "bg-amber-300",
    pending: "bg-muted animate-pulse",
  };

  return (
    <span
      className={twMerge(
        clsx(
          "mono-label inline-flex items-center gap-2 border bg-surface px-2.5 py-1",
          toneClass[tone],
          className
        )
      )}
      {...props}
    >
      <span className={clsx("h-1.5 w-1.5", dotClass[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
