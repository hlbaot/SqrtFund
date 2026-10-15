"use client";

import React from "react";
import clsx from "clsx";

export type StatTone = "default" | "primary" | "money" | "muted";

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  tone?: StatTone;
  variant?: "md" | "lg";
  title?: string;
  className?: string;
}

/**
 * Standard Stat component enforcing typography tokens:
 * - Label: role-label (mono, uppercase, 12px, letter-spacing 0.12em, muted)
 * - Value: role-value-md (mono, tabular, 20px/28px, weight 600) or role-value-lg (32px hero)
 * - Unit: role-unit (mono, 12px, muted, aligned to the baseline of its value)
 */
export function Stat({
  label,
  value,
  unit,
  tone = "default",
  variant = "md",
  title,
  className = "",
}: StatProps) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "money"
      ? "text-money"
      : tone === "muted"
      ? "text-muted"
      : "text-foreground";

  const valueClass = variant === "lg" ? "value-lg" : "value-md";

  return (
    <div className={clsx("min-w-0 flex flex-col justify-start", className)}>
      <dt
        className="role-label truncate mb-1.5"
        title={typeof label === "string" ? label : undefined}
      >
        {label}
      </dt>
      <dd
        className={clsx(
          valueClass,
          toneClass,
          "flex items-baseline gap-1.5 truncate"
        )}
        title={
          title ??
          (typeof value === "string" || typeof value === "number"
            ? String(value)
            : undefined)
        }
      >
        <span className="truncate">{value}</span>
        {unit && <span className="role-unit shrink-0">{unit}</span>}
      </dd>
    </div>
  );
}

export interface StatGroupProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  bordered?: boolean;
  className?: string;
}

/**
 * StatGroup component: CSS grid with equal columns and hairline dividers,
 * items aligned to the top, all labels on the same baseline, all values on the same baseline.
 */
export function StatGroup({
  children,
  columns = 3,
  bordered = true,
  className = "",
}: StatGroupProps) {
  const colClass =
    columns === 2
      ? "grid-cols-2"
      : columns === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : "grid-cols-3";

  const validChildren = React.Children.toArray(children).filter(Boolean);
  const total = validChildren.length;

  return (
    <dl
      className={clsx(
        "grid items-start divide-x divide-line",
        bordered && "border-y border-line py-3.5",
        colClass,
        className
      )}
    >
      {validChildren.map((child, index) => (
        <div
          key={index}
          className={clsx(
            "min-w-0",
            index === 0
              ? "pr-3"
              : index === total - 1
              ? "pl-3"
              : "px-3"
          )}
        >
          {child}
        </div>
      ))}
    </dl>
  );
}
