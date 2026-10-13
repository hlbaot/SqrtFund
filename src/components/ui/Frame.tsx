import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface FrameProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Frame({ className, interactive = false, children, ...props }: FrameProps) {
  return (
    <div
      className={twMerge(
        clsx(
          "hud-frame",
          interactive && "transition-colors hover:bg-surface-2",
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}
