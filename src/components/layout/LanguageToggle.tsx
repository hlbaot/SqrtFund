"use client";

import React from "react";
import { useLocale } from "@/lib/context/locale";

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center border border-line-strong bg-bg p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-label="Switch to English"
        className={`rounded px-2 py-1 transition-colors ${
          locale === "en"
            ? "bg-surface text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("vi")}
        aria-label="Chuyển sang Tiếng Việt"
        className={`rounded px-2 py-1 transition-colors ${
          locale === "vi"
            ? "bg-surface text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        VI
      </button>
    </div>
  );
}
