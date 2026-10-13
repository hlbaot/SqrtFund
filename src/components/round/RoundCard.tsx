"use client";

import React from "react";
import Link from "next/link";
import type { Round } from "@/types";
import { formatUsdc, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { CountdownTimer } from "./CountdownTimer";
import { Badge } from "@/components/ui/Badge";
import { Frame } from "@/components/ui/Frame";
import { ArrowRight, Shield } from "lucide-react";

export interface RoundCardProps {
  round: Round;
  className?: string;
}

export function RoundCard({ round, className = "" }: RoundCardProps) {
  const { t } = useLocale();
  const effectiveStatus = round.status;

  return (
    <Frame className={`p-6 ${className}`} interactive>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge
            variant={effectiveStatus === "open" ? "primary" : "secondary"}
          >
            {effectiveStatus === "open"
              ? t.roundCard.statusOpen
              : effectiveStatus === "closed"
              ? t.roundCard.statusClosed
              : t.roundCard.statusFinalized}
          </Badge>
          <span className="mono-label flex items-center gap-1 text-muted">
            <Shield className="h-3.5 w-3.5 text-muted" />
            <span>{round.sponsorName}</span>
          </span>
        </div>

        <CountdownTimer endTime={round.endTime} statusOverride={effectiveStatus} />
      </div>

      <div className="mt-4">
        <h3 className="text-xl font-bold text-foreground tracking-tight">
          {round.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">
          {round.description}
        </p>
      </div>

      {/* Round stats banner */}
      <div className="mt-5 grid grid-cols-3 border border-line bg-bg p-3.5">
        <div>
          <span className="mono-label block text-muted">
            {t.roundCard.poolLabel}
          </span>
          <span className="tabular-mono text-base font-black text-money sm:text-lg">
            {formatUsdc(round.matchingPool)}
          </span>
        </div>

        <div>
          <span className="mono-label block text-muted">
            {t.roundCard.raisedLabel}
          </span>
          <span className="tabular-mono text-base font-bold text-foreground sm:text-lg">
            {formatUsdc(round.totalDonated)}
          </span>
        </div>

        <div>
          <span className="mono-label block text-muted">
            {t.roundCard.supportersLabel}
          </span>
          <span className="tabular-mono text-base font-bold text-primary sm:text-lg">
            {formatNumber(round.totalSupporters)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Link
          href={`/round/${round.id}`}
          className="mono-label inline-flex items-center gap-1.5 border border-primary bg-primary/10 px-4 py-2 text-primary transition-colors hover:bg-primary hover:text-foreground focus:outline-none"
        >
          <span>{t.roundCard.viewRound}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Frame>
  );
}
