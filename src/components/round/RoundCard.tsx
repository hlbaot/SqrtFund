"use client";

import React from "react";
import Link from "next/link";
import type { Round } from "@/types";
import { formatUsdc, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { ExplorerLink } from "@/components/tx/ExplorerLink";
import { CountdownTimer } from "./CountdownTimer";
import { Badge } from "@/components/ui/Badge";
import { Frame } from "@/components/ui/Frame";
import { ArrowRight } from "lucide-react";
import { Stat, StatGroup } from "@/components/common/Stat";

export interface RoundCardProps {
  round: Round;
  className?: string;
  roundIndex?: number;
}

export function RoundCard({ round, className = "", roundIndex }: RoundCardProps) {
  const { t } = useLocale();
  const effectiveStatus = round.status;

  const fallbackTitle = roundIndex
    ? `${t.homeIntro.roundTitle} #${roundIndex}`
    : round.title || `${t.homeIntro.roundTitle} #1`;

  const displayTitle = round.name && round.name.trim().length > 0
    ? round.name.trim()
    : fallbackTitle;

  const displayOrganizer = round.organizer && round.organizer.trim().length > 0
    ? round.organizer.trim()
    : null;

  return (
    <Frame className={`p-6 ${className}`} interactive>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant={effectiveStatus === "open" ? "primary" : effectiveStatus === "finalized" ? "accent" : "secondary"}>
            {effectiveStatus === "open"
              ? t.roundCard.statusOpen
              : effectiveStatus === "closed"
                ? t.roundCard.statusClosed
                : t.roundCard.statusFinalized}
          </Badge>

          <ExplorerLink address={round.id} iconOnly label={t.onChain.roundContract} />

        </div>

        <CountdownTimer endTime={round.endTime} statusOverride={effectiveStatus} />
      </div>

      <div className="mt-4">
        <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {displayTitle}
        </h3>
        {displayOrganizer && (
          <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted sm:text-sm">
            {displayOrganizer}
          </p>
        )}
      </div>

      {/* Matching Pool: single hero metric on the card */}
      <div className="mt-4">
        <p className="role-label text-muted">{t.roundCard.poolLabel}</p>
        <div className="mt-1 flex items-baseline gap-1.5 text-money">
          <span
            className="value-lg text-money"
            title={formatUsdc(round.matchingPool)}
          >
            {formatUsdc(round.matchingPool, { includeSymbol: false, compact: true })}
          </span>
          <span className="role-unit">USDC</span>
        </div>
      </div>

      {/* Stats group: Supporters first (primary tone), Projects, Raised */}
      <StatGroup columns={3} className="my-4">
        <Stat
          label={t.roundCard.supportersLabel}
          value={formatNumber(round.totalSupporters)}
          tone="primary"
          title={formatNumber(round.totalSupporters)}
        />
        <Stat
          label={t.competition?.projects || "Projects"}
          value={formatNumber(round.projectCount)}
          tone="default"
          title={formatNumber(round.projectCount)}
        />
        <Stat
          label={t.roundCard.raisedLabel}
          value={formatUsdc(round.totalDonated, { includeSymbol: false, compact: true })}
          unit="USDC"
          tone="default"
          title={formatUsdc(round.totalDonated)}
        />
      </StatGroup>

      {/* CTA pinned to bottom */}
      <Link
        href={`/round/${round.id}`}
        className="mono-label inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 border border-primary bg-primary/10 px-6 py-2.5 text-primary transition-all hover:bg-primary hover:text-foreground cursor-pointer active:scale-[0.99] focus:outline-none"
      >
        <span>{t.roundCard.viewRound}</span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Frame>
  );
}
