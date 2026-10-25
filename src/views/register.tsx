"use client";
import { StudentAccessGate } from "@/components/verify/StudentAccessGate";
import { useStudentStatus } from "@/hooks/useStudentStatus";

import { AOSInit } from "@/components/common/AOSInit";

import React from "react";
import { ProjectForm } from "@/components/project/ProjectForm";
import { useLocale } from "@/lib/context/locale";
import { Container } from "@/components/layout/Container";
import { useAccount } from "wagmi";
import { ConnectWalletButton } from "@/components/layout/ConnectWalletButton";

export function RegisterView({ initialRound }: { initialRound?: string } = {}) {
  const { t } = useLocale();
  const { isConnected } = useAccount();
  const { isStudent, isLoading } = useStudentStatus();

  if (!isConnected) {
    return (
      <Container className="py-8 sm:py-10">
        <div className="mx-auto max-w-xl py-16 text-center space-y-4">
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t.common.walletRequired}</h1>
          <p className="text-sm text-muted">{t.common.walletRequiredDesc}</p>
          <ConnectWalletButton />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10 space-y-8">
      <AOSInit />
      <div data-aos="fade-down" data-aos-duration="600">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {t.register.title}
        </h1>
        <p className="mt-1 text-sm text-muted max-w-2xl leading-relaxed">
          {t.register.subtitle}
        </p>
      </div>

      {isLoading ? <p role="status">{t.common.loading}</p> : isStudent ? <ProjectForm key={initialRound ?? "default"} initialRound={initialRound} /> : <StudentAccessGate />}
    </Container>
  );
}
