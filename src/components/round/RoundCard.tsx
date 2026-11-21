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
import { Stat } from "@/components/common/Stat";

export interface RoundCardProps {
  round: Round;
  className?: string;
  roundIndex?: number;
}

export function RoundCard({ round, className = "", roundIndex }: RoundCardProps) {
  const { t, locale } = useLocale();
  const effectiveStatus = round.status;
  const isOpen = effectiveStatus === "open";
  const statusLabel = {
    open: t.roundCard.statusOpen,
    closed: t.roundCard.statusClosed,
    finalized: t.roundCard.statusFinalized,
    cancelled: t.competition.cancelled,
  }[effectiveStatus];

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
    <Frame className={`flex min-w-0 flex-col gap-3 p-4 ${className}`} interactive>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Badge variant={isOpen ? "primary" : effectiveStatus === "finalized" ? "accent" : "secondary"}>
          {statusLabel}
        </Badge>
        <ExplorerLink address={round.id} iconOnly label={t.onChain.roundContract} />
        {isOpen && round.endTime && <CountdownTimer endTime={round.endTime} />}
      </div>

      <div className="flex-1">
        <h3 className="line-clamp-2 text-lg font-bold tracking-tight text-foreground wrap-anywhere">
          {displayTitle}
        </h3>
        {displayOrganizer && (
          <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-muted sm:text-sm">
            {displayOrganizer}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3">
        <Stat
          label={t.roundCard.poolLabel}
          value={formatUsdc(round.matchingPool, { includeSymbol: false, compact: true })}
          unit="USDC"
          tone="money"
          title={formatUsdc(round.matchingPool)}
        />
        <Stat
          label={t.projectCard.directDonations}
          value={formatUsdc(round.totalDonated, { includeSymbol: false, compact: true })}
          unit="USDC"
          title={formatUsdc(round.totalDonated)}
        />
        <Stat
          label={t.roundCard.supportersLabel}
          value={formatNumber(round.totalSupporters)}
          tone="primary"
          title={formatNumber(round.totalSupporters)}
        />
        <Stat
          label={t.roundCard.projectsLabel}
          value={formatNumber(round.projectCount)}
          title={formatNumber(round.projectCount)}
        />
      </dl>

      <Link
        href={`/round/${round.id}`}
        className="mono-label inline-flex min-h-11 w-full items-center justify-center gap-2 border border-primary bg-primary/10 px-3 py-2 text-primary transition-colors hover:bg-primary hover:text-foreground"
      >
        <span>{locale === "vi" ? "Xem vòng" : "View round"}</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </Frame>
  );
}
