"use client";

import React from "react";
import { ProjectForm } from "@/components/project/ProjectForm";
import { useLocale } from "@/lib/context/locale";

export function RegisterView() {
  const { t } = useLocale();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {t.register.title}
        </h1>
        <p className="mt-1 text-sm text-muted max-w-2xl leading-relaxed">
          {t.register.subtitle}
        </p>
      </div>

      <ProjectForm />
    </div>
  );
}
