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
        className={`rounded px-2 py-1 transition-all cursor-pointer active:scale-95 ${
          locale === "en"
            ? "bg-surface text-foreground shadow-xs"
            : "text-muted hover:text-foreground hover:bg-surface/60"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("vi")}
        aria-label="Chuyển sang Tiếng Việt"
        className={`rounded px-2 py-1 transition-all cursor-pointer active:scale-95 ${
          locale === "vi"
            ? "bg-surface text-foreground shadow-xs"
            : "text-muted hover:text-foreground hover:bg-surface/60"
        }`}
      >
        VI
      </button>
    </div>
  );
}
