"use client";

import { AOSInit } from "@/components/common/AOSInit";

import React from "react";
import { ProjectForm } from "@/components/project/ProjectForm";
import { useLocale } from "@/lib/context/locale";
import { Container } from "@/components/layout/Container";

export function RegisterView() {
  const { t } = useLocale();

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

      <ProjectForm />
    </Container>
  );
}
