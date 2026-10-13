"use client";

import React from "react";
import { formatUsdc, formatNumber } from "@/lib/format";
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
      label: t.roundCard.poolLabel,
      value: formatUsdc(matchingPool),
      icon: Coins,
      accent: "text-money",
      bg: "bg-money/10",
      border: "border-money/20",
    },
    {
      label: t.roundCard.raisedLabel,
      value: formatUsdc(totalDonated),
      icon: Award,
      accent: "text-foreground",
      bg: "bg-surface-2",
      border: "border-line-strong",
    },
    {
      label: t.roundCard.supportersLabel,
      value: `${formatNumber(totalSupporters)}`,
      icon: Users,
      accent: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Active projects",
      value: formatNumber(projectCount),
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
            className={`${stat.border} ${stat.bg} p-4 transition-all hover:border-line-strong`}
            interactive
          >
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Icon className={`h-4 w-4 ${stat.accent}`} />
              <span className="mono-label truncate">{stat.label}</span>
            </div>
            <div className={`mt-2 tabular-mono text-xl sm:text-2xl font-black ${stat.accent}`}>
              {stat.value}
            </div>
          </Frame>
        );
      })}
    </div>
  );
}
