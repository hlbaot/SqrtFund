"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Round } from "@/types";
import { formatUsdc, formatNumber, shortAddress } from "@/lib/format";
import { useLocale } from "@/lib/context/locale";
import { CountdownTimer } from "./CountdownTimer";
import { Badge } from "@/components/ui/Badge";
import { Frame } from "@/components/ui/Frame";
import { ArrowRight, Check, Copy } from "lucide-react";

export interface RoundCardProps {
  round: Round;
  className?: string;
  adminAddress?: string;
  roundIndex?: number;
}

export function RoundCard({ round, className = "", adminAddress, roundIndex }: RoundCardProps) {
  const { t } = useLocale();
  const effectiveStatus = round.status;
  const [copied, setCopied] = useState(false);

  const fallbackTitle = roundIndex
    ? `${t.homeIntro.roundTitle} #${roundIndex}`
    : round.title || `${t.homeIntro.roundTitle} #1`;

  const displayTitle = round.name && round.name.trim().length > 0
    ? round.name.trim()
    : fallbackTitle;

  const displayOrganizer = round.organizer && round.organizer.trim().length > 0
    ? round.organizer.trim()
    : null;

  const handleCopyAdmin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (adminAddress) {
      navigator.clipboard.writeText(adminAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Frame className={`p-6 ${className}`} interactive>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant={effectiveStatus === "open" ? "primary" : "secondary"}>
            {effectiveStatus === "open"
              ? t.roundCard.statusOpen
              : effectiveStatus === "closed"
              ? t.roundCard.statusClosed
              : t.roundCard.statusFinalized}
          </Badge>

          {adminAddress && (
            <div className="mono-label flex items-center gap-1.5 border border-line bg-surface px-2.5 py-1 text-xs">
              <span className="text-muted">{t.homeIntro.roundAdminLabel}:</span>
              <span className="tabular-mono text-foreground">{shortAddress(adminAddress)}</span>
              <button
                type="button"
                onClick={handleCopyAdmin}
                className="ml-0.5 text-muted hover:text-foreground focus:outline-none"
                title={copied ? t.homeIntro.copied : t.common.copyAddress}
                aria-label={t.common.copyAddress}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-money" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          )}
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

      {/* Round stats & CTA banner: inline stats with right-aligned CTA on desktop, stacked on mobile */}
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-3 gap-2 border border-line bg-bg p-3.5 sm:gap-4">
          <div>
            <span className="mono-label block text-xs text-muted">{t.roundCard.poolLabel}</span>
            <span className="tabular-mono text-base font-black text-money sm:text-lg">
              {formatUsdc(round.matchingPool)}
            </span>
          </div>

          <div>
            <span className="mono-label block text-xs text-muted">{t.roundCard.raisedLabel}</span>
            <span className="tabular-mono text-base font-bold text-foreground sm:text-lg">
              {formatUsdc(round.totalDonated)}
            </span>
          </div>

          <div>
            <span className="mono-label block text-xs text-muted">{t.roundCard.supportersLabel}</span>
            <span className="tabular-mono text-base font-bold text-primary sm:text-lg">
              {formatNumber(round.totalSupporters)}
            </span>
          </div>
        </div>

        <Link
          href={`/round/${round.id}`}
          className="mono-label inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 border border-primary bg-primary/10 px-6 py-2.5 text-primary transition-colors hover:bg-primary hover:text-foreground focus:outline-none lg:w-auto"
        >
          <span>{t.roundCard.viewRound}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Frame>
  );
}
