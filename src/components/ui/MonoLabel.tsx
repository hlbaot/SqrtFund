import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function MonoLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={twMerge(clsx("mono-label text-muted", className))} {...props}>
      {children}
    </span>
  );
}
