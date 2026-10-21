"use client";

import React from "react";
import { useCurrentTimestamp } from "@/hooks/useCurrentTimestamp";
import { Clock } from "lucide-react";
import { useLocale } from "@/lib/context/locale";

export interface CountdownTimerProps {
  endTime: string | Date | number | bigint;
  statusOverride?: "open" | "closed" | "finalized" | "cancelled";
  className?: string;
  prominent?: boolean;
  inline?: boolean;
  nowSeconds?: number;
}

export function CountdownTimer({
  endTime,
  statusOverride = "open",
  className = "",
  prominent = false,
  inline = false,
  nowSeconds,
}: CountdownTimerProps) {
  const { t, locale } = useLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const effectiveStatus = statusOverride;

  const clock = useCurrentTimestamp();
  const now = nowSeconds ?? clock;
  const endMs = typeof endTime === "bigint" ? Number(endTime) * 1000
    : typeof endTime === "number" ? (endTime < 1e11 ? endTime * 1000 : endTime)
    : new Date(endTime).getTime();
  const diff = Math.max(0, endMs - now * 1000);
  const timeLeft = {
    days: Math.floor(diff / 86_400_000), hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60, seconds: Math.floor(diff / 1000) % 60,
    isEnded: diff === 0,
  };

  if (effectiveStatus !== "open" || (!inline && now > 0 && Number.isFinite(endMs) && timeLeft.isEnded)) {
    return (
      <div
        className={`mono-label inline-flex items-center gap-1.5 border border-line-strong bg-surface-2 px-3 py-1 text-muted ${className}`}
      >
        <span className="h-1.5 w-1.5 bg-primary" />
        <span>{effectiveStatus === "finalized" ? t.competition.finalized : effectiveStatus === "cancelled" ? t.competition.cancelled : t.roundCard.statusClosed}</span>
      </div>
    );
  }

  if (now <= 0 || !Number.isFinite(endMs)) return <span className={className}>—</span>;
  if (inline) return <span className={`tabular-mono ${className}`}>
    {number(timeLeft.days)} {t.competition.days} {number(timeLeft.hours)} {t.competition.hours} {number(timeLeft.minutes)} {t.competition.minutes} {number(timeLeft.seconds)} {t.competition.seconds}
  </span>;

  if (prominent) {
    return (
      <div className={`tabular-mono flex items-center gap-2 ${className}`}>
        <div className="flex min-w-[54px] flex-col items-center border border-line bg-bg px-3 py-2 text-center">
          <span className="role-value-md text-foreground">{number(timeLeft.days)}</span>
          <span className="role-label text-muted">{t.competition.days}</span>
        </div>
        <span className="text-lg font-bold text-muted">:</span>
        <div className="flex min-w-[54px] flex-col items-center border border-line bg-bg px-3 py-2 text-center">
          <span className="role-value-md text-foreground">{number(timeLeft.hours)}</span>
          <span className="role-label text-muted">{t.competition.hours}</span>
        </div>
        <span className="text-lg font-bold text-muted">:</span>
        <div className="flex min-w-[54px] flex-col items-center border border-line bg-bg px-3 py-2 text-center">
          <span className="role-value-md text-foreground">{number(timeLeft.minutes)}</span>
          <span className="role-label text-muted">{t.competition.minutes}</span>
        </div>
        <span className="text-lg font-bold text-muted">:</span>
        <div className="flex min-w-[54px] flex-col items-center border border-line bg-bg px-3 py-2 text-center">
          <span className="role-value-md text-primary">{number(timeLeft.seconds)}</span>
          <span className="role-label text-muted">{t.competition.seconds}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`tabular-mono inline-flex items-center gap-1.5 text-xs font-medium text-foreground ${className}`}
    >
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span>
        {number(timeLeft.days)} {t.competition.days} · {number(timeLeft.hours)} {t.competition.hours} · {number(timeLeft.minutes)} {t.competition.minutes}
      </span>
    </div>
  );
}
