import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={twMerge(
        clsx(
          "relative overflow-hidden border border-line bg-surface-2 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
          className
        )
      )}
      {...props}
    />
  );
}
