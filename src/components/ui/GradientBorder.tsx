import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function GradientBorder({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx("gradient-border", className))} {...props}>
      {children}
    </div>
  );
}
