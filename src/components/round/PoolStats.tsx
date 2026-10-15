"use client";

import React from "react";
import { formatUsdc, formatCount } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { Coins, Users, FolderKanban, Award } from "lucide-react";
import { Frame } from "@/components/ui/Frame";

export interface PoolStatsProps {
  matchingPool: number;
  totalDonated: number;
  totalSupporters: number;
  projectCount: number;
  className?: string;
}

export function PoolStats({
  matchingPool,
  totalDonated,
  totalSupporters,
  projectCount,
  className = "",
}: PoolStatsProps) {
  const { t } = useLocale();

  const stats = [
    {
      label: t.roundCard.supportersLabel,
      value: formatCount(totalSupporters),
      fullValue: formatCount(totalSupporters),
      icon: Users,
      accent: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: t.roundCard.poolLabel,
      value: formatUsdc(matchingPool, { compact: true }),
      fullValue: formatUsdc(matchingPool),
      icon: Coins,
      accent: "text-money",
      bg: "bg-money/10",
      border: "border-money/20",
    },
    {
      label: t.roundCard.raisedLabel,
      value: formatUsdc(totalDonated, { compact: true }),
      fullValue: formatUsdc(totalDonated),
      icon: Award,
      accent: "text-foreground",
      bg: "bg-surface-2",
      border: "border-line-strong",
    },
    {
      label: t.roundCard.projectsLabel,
      value: formatCount(projectCount),
      fullValue: formatCount(projectCount),
      icon: FolderKanban,
      accent: "text-muted",
      bg: "bg-surface-2",
      border: "border-line",
    },
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3.5 ${className}`}>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <Frame
            key={i}
            className={`${stat.border} ${stat.bg} p-4 transition-all hover:border-line-strong overflow-hidden`}
            interactive
          >
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Icon className={`h-4 w-4 shrink-0 ${stat.accent}`} />
              <span className="role-label truncate">{stat.label}</span>
            </div>
            <div
              title={stat.fullValue}
              className={`mt-2 value-md truncate block ${stat.accent}`}
            >
              {stat.value}
            </div>
          </Frame>
        );
      })}
    </div>
  );
}
