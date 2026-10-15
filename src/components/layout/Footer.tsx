"use client";

import React from "react";
import { useLocale } from "@/lib/context/locale";
import { Badge } from "@/components/ui/Badge";

import { Container } from "./Container";

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="mt-auto border-t border-line bg-bg py-8 text-xs text-muted">
      <Container className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        <div className="mono-label flex items-center gap-3 text-muted">
          <span>{t.footer.model}</span>
          <span>/</span>
          <span>{t.common.testnetBadge}</span>
        </div>
      </Container>
    </footer>
  );
}
