"use client";

import { useLocale } from "@/lib/context/locale";

/** Bounded page links: first/last, current neighbours, and non-interactive gaps. */
export function paginationItems(page: number, totalPages: number): (number | string)[] {
  const pages = Array.from(new Set([1, totalPages, page - 1, page, page + 1]))
    .filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  return pages.flatMap((value, index) => {
    const previous = pages[index - 1];
    return index && value - previous > 1
      ? value - previous === 2 ? [previous + 1, value] : [`gap-${previous}`, value]
      : [value];
  });
}

export function Pagination({ page, pageSize, total, onPageChange, controls, label }: {
  page: number; pageSize: number; total: number; onPageChange: (page: number) => void;
  controls?: string; label?: string;
}) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(page, totalPages));
  const pageLabel = vi ? "Trang" : "Page";
  const buttonClass = "pagination-button competition-focus inline-flex min-h-11 min-w-11 items-center justify-center border border-line bg-surface px-3 text-xs text-foreground disabled:cursor-not-allowed disabled:text-muted";
  return <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
    <p role="status" aria-live="polite" className="text-xs text-muted tabular-mono">
      {pageLabel} {current} / {totalPages}<span className="mx-2" aria-hidden="true">·</span>
      {vi ? "Hiển thị" : "Showing"} {total ? (current - 1) * pageSize + 1 : 0}-{Math.min(current * pageSize, total)} / {total}
    </p>
    <nav aria-label={label ?? (vi ? "Phân trang" : "Pagination")} className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={buttonClass} disabled={current === 1} aria-controls={controls} aria-label={vi ? "Trang trước" : "Previous page"} onClick={() => onPageChange(current - 1)}>{vi ? "Trước" : "Previous"}</button>
      {paginationItems(current, totalPages).map(item => typeof item === "string"
        ? <span key={item} className="px-1 text-muted" aria-hidden="true">...</span>
        : <button key={item} type="button" className={buttonClass} aria-label={`${pageLabel} ${item}`} aria-current={item === current ? "page" : undefined} aria-controls={controls} onClick={() => onPageChange(item)}>{item}</button>)}
      <button type="button" className={buttonClass} disabled={current === totalPages} aria-controls={controls} aria-label={vi ? "Trang sau" : "Next page"} onClick={() => onPageChange(current + 1)}>{vi ? "Sau" : "Next"}</button>
    </nav>
  </div>;
}
