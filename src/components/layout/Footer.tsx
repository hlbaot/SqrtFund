"use client";

import React from "react";
import { useLocale } from "@/lib/context/locale";
import { Badge } from "@/components/ui/Badge";

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="mt-auto border-t border-line bg-bg py-8 text-xs text-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/sqrt-fund-logo.png"
            alt="√Fund"
            className="h-7 w-auto object-contain"
          />
          <span className="text-line-strong">/</span>
          <span>{t.common.tagline}</span>
          <span className="text-line-strong">/</span>
          <Badge variant="secondary" className="text-[10px] tracking-wide">
            {t.common.testnetBadge}
          </Badge>
        </div>

        <div className="mono-label flex items-center gap-4 text-muted">
          <span>Vietnam UniHack Team 1</span>
          <span>/</span>
          <span>Quadratic Funding Model</span>
        </div>
      </div>
    </footer>
  );
}
