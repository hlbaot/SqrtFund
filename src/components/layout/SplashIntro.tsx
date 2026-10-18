"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { copy } from "@/lib/copy";

function finishSplash() {
  document.documentElement.classList.remove("splash-active");
  window.dispatchEvent(new Event("splash-intro-finished"));
}

export function SplashIntro({ initialLocale = "vi" }: { initialLocale?: "en" | "vi" }) {
  const [locale] = useState<"en" | "vi">(initialLocale);
  const splashCopy = (locale === "vi" ? copy.vi : copy.en).splashIntro;

  useEffect(() => {
    if (!document.documentElement.classList.contains("splash-active")) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      finishSplash();
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        finishSplash();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const timer = window.setTimeout(finishSplash, 2500);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      role="status"
      aria-label={splashCopy.ariaLabel}
      onClick={finishSplash}
      className="splash-intro fixed inset-0 z-[2147483647] flex cursor-pointer select-none items-center justify-center overflow-hidden bg-bg px-[max(1.25rem,env(safe-area-inset-left))] py-[max(1.25rem,env(safe-area-inset-top))]"
    >
      <div className="splash-grid absolute inset-0" aria-hidden="true" />
      <div className="splash-glow absolute inset-0" aria-hidden="true" />


      <div className="relative z-10 flex w-full max-w-[min(34rem,100%)] flex-col items-center text-center">
        <div className="splash-logo-wrap flex flex-col items-center">
          <Image
            src="/brand/sqrt-fund-logo.png"
            alt="SqrtFund"
            width={182}
            height={126}
            priority
            aria-hidden="true"
            className="h-auto w-36 sm:w-44 object-contain"
          />
          <div className="mt-4 h-1 w-36 sm:w-44 border border-primary/40 bg-surface">
            <div className="splash-progress h-full bg-primary" aria-hidden="true" />
          </div>
        </div>

        <div className="splash-tagline mt-6 space-y-2">
          <p className="role-label text-sm sm:text-base text-foreground font-medium tracking-wide">
            {splashCopy.tagline}
          </p>
          <p className="role-label font-mono text-xs text-primary tracking-wider">
            {splashCopy.eventLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
