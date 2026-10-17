"use client";

import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useLocale } from "@/lib/context/locale";

export interface CountdownTimerProps {
  endTime: string | Date | number | bigint;
  statusOverride?: "open" | "closed" | "finalized" | "cancelled";
  className?: string;
  prominent?: boolean;
}

export function CountdownTimer({
  endTime,
  statusOverride = "open",
  className = "",
  prominent = false,
}: CountdownTimerProps) {
  const { t, locale } = useLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const effectiveStatus = statusOverride;

  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isEnded: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: false });

  useEffect(() => {
    const calculate = () => {
      if (effectiveStatus !== "open") {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: true });
        return;
      }

      const endMs =
        typeof endTime === "bigint"
          ? Number(endTime) * 1000
          : typeof endTime === "number"
          ? endTime < 1e11
            ? endTime * 1000
            : endTime
          : new Date(endTime).getTime();

      const diff = endMs - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isEnded: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isEnded: false });
    };

    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [endTime, effectiveStatus]);

  if (effectiveStatus !== "open" || timeLeft.isEnded) {
    return (
      <div
        className={`mono-label inline-flex items-center gap-1.5 border border-line-strong bg-surface-2 px-3 py-1 text-muted ${className}`}
      >
        <span className="h-1.5 w-1.5 bg-primary" />
        <span>{t.roundCard.statusClosed}</span>
      </div>
    );
  }

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
