import React from "react";
import { useLocale } from "@/lib/context/locale";

export interface SupporterMarksProps {
  count: number;
  maxMarks?: number;
  scale?: number; // 1 mark = scale supporters
  className?: string;
  compact?: boolean;
}

export function SupporterMarks({
  count,
  maxMarks = 36,
  scale = 5,
  className = "",
  compact = false,
}: SupporterMarksProps) {
  const { t, locale } = useLocale();
  const markCount = Math.max(0, Math.min(maxMarks, Math.ceil(count / scale)));
  const marks = Array.from({ length: markCount });

  return (
    <div
      className={`border border-line bg-surface p-3 transition-colors ${className}`}
      aria-label={`${count} ${t.common.supporters}, ${markCount} marks`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 text-muted">
          <span className="h-2 w-2 bg-primary" aria-hidden="true" />
          <span className="mono-label text-muted">
            {t.common.supporters}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="tabular-mono text-2xl font-black tracking-tight text-foreground">
            {count}
          </span>
          <span className="text-xs text-muted">
            {locale === "vi" ? "người" : "students"}
          </span>
        </div>
      </div>

      {/* Memorable supporter marks: high-contrast rows of discrete marks */}
      <div
        className="mt-2.5 flex flex-wrap gap-1"
        aria-hidden="true"
      >
        {marks.length === 0 ? (
          <span className="text-xs italic text-muted">No supporters yet</span>
        ) : (
          marks.map((_, i) => (
            <span
              key={i}
              title={`Supporters ${i * scale + 1}-${Math.min((i + 1) * scale, count)}`}
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
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span>{t.projectCard.oneMarkNote}</span>
          <span className="tabular-mono text-muted">
            {count > 0 ? `${markCount} marks` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
