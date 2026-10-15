import React from "react";
import { fmt } from "@/lib/copy";
import { useLocale } from "@/lib/context/locale";

export interface SupporterMarksProps {
  count: number;
  maxMarks?: number;
  scale?: number; // 1 mark = scale supporters
  className?: string;
  compact?: boolean;
  marksOnly?: boolean;
}

export function SupporterMarks({
  count,
  maxMarks = 36,
  scale = 5,
  className = "",
  compact = false,
  marksOnly = false,
}: SupporterMarksProps) {
  const { t, locale } = useLocale();
  const markCount = Math.max(0, Math.min(maxMarks, Math.ceil(count / scale)));
  const marks = Array.from({ length: markCount });

  if (marksOnly) return <div className={className}>
    <div className="flex min-h-3 flex-wrap gap-1" aria-hidden="true">{marks.map((_, index) => <span key={index} className="h-2 w-2 bg-money" />)}</div>
    <p className="mt-2 text-xs text-muted">{count ? fmt(t.competition.marksNote, { n: new Intl.NumberFormat(locale).format(scale) }) : t.competition.noSupporters}</p>
  </div>;

  return (
    <div
      className={`border border-line bg-surface p-3 transition-colors ${className}`}
      aria-label={`${count} ${t.common.supporters}, ${fmt(t.competition.marksCount, { count: markCount })}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 text-muted">
          <span className="h-2 w-2 bg-primary" aria-hidden="true" />
          <span className="role-label text-muted">
            {t.common.supporters}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="role-value-md text-foreground">
            {count}
          </span>
          <span className="role-unit text-muted">
            {t.common.supporters}
          </span>
        </div>
      </div>

      {/* Memorable supporter marks: high-contrast rows of discrete marks */}
      <div
        className="mt-2.5 flex flex-wrap gap-1"
        aria-hidden="true"
      >
        {marks.length === 0 ? (
          <span className="text-xs italic text-muted">{t.competition.noSupporters}</span>
        ) : (
          marks.map((_, i) => (
            <span
              key={i}
              title={fmt(t.competition.marksRange, { from: i * scale + 1, to: Math.min((i + 1) * scale, count) })}
              className={`h-2.5 w-2.5 transition-transform ${
                i < 8
                  ? "bg-money"
                  : i < 20
                  ? "bg-primary"
                  : "bg-line-strong"
              }`}
            />
          ))
        )}
      </div>

      {!compact && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{t.projectCard.oneMarkNote}</span>
          <span className="tabular-mono text-muted">
            {count > 0 ? fmt(t.competition.marksCount, { count: markCount }) : ""}
          </span>
        </div>
      )}
    </div>
  );
}
