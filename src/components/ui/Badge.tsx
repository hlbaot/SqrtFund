import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type BadgeVariant =
  | "default"
  | "primary"
  | "accent"
  | "secondary"
  | "outline"
  | "warning";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-surface text-muted border-line-strong",
    primary: "bg-primary/10 text-primary border-primary/40 font-semibold",
    accent: "bg-money/10 text-money border-money/40 font-semibold",
    secondary: "bg-surface text-muted border-line",
    outline: "border-line-strong text-foreground bg-transparent",
    warning: "bg-amber-400/10 text-amber-300 border-amber-400/40 font-semibold",
  };

  return (
    <span
      className={twMerge(
        clsx(
          "mono-label inline-flex items-center border px-2.5 py-1 transition-colors",
          variantStyles[variant],
          className
        )
      )}
      {...props}
    >
      {children}
    </span>
  );
}
