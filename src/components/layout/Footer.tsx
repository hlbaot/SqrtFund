"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/lib/context/locale";
import { ContractExplorerLinks } from "@/components/tx/ContractExplorerLinks";
import { Badge } from "@/components/ui/Badge";
import { ChainLatticeBackground } from "@/components/background/DeferredLattice";

import { Container } from "./Container";

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="relative z-10 chain-lattice-host mt-auto py-8 text-xs text-muted">
      <ChainLatticeBackground variant="footer" />
      <Container className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="flex min-h-[44px] items-center shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs"
            aria-label="N-Power"
          >
            <Image
              src="/brand/logo_sqrtfund.png"
              alt="SqrtFund"
              width={128}
              height={64}
              className="h-8 w-auto shrink-0 object-contain"
            />
          </Link>
          <span className="text-line-strong">/</span>
          <span>{t.common.tagline}</span>
          <span className="text-line-strong">/</span>
          <Badge variant="secondary" className="text-xs tracking-wide">
            {t.common.testnetBadge}
          </Badge>
        </div>

        <div className="mono-label flex items-center gap-3 text-muted">
          <span>{t.footer.model}</span>
          <span>/</span>
          <span>{t.common.testnetBadge}</span>
        </div>
      </Container>
      <Container className="relative z-10 mt-4"><ContractExplorerLinks /></Container>
    </footer>
  );
}
