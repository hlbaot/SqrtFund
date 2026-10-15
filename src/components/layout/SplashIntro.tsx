"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { copy } from "@/lib/copy";

const splashCopy = copy.en.splashIntro;

function finishSplash() {
  document.documentElement.classList.remove("splash-active");
  window.dispatchEvent(new Event("splash-intro-finished"));
}

export function SplashIntro() {
  useEffect(() => {
    if (!document.documentElement.classList.contains("splash-active")) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(finishSplash, reducedMotion ? 800 : 3000);
    return () => { window.clearTimeout(timer); };
  }, []);

  // Static markup lets the head bootstrap show the intro before hydration.
  return (
    <div
      role="status"
      aria-label={splashCopy.ariaLabel}
      onClick={finishSplash}
      className="splash-intro fixed inset-0 z-[2147483647] cursor-pointer select-none items-center justify-center overflow-hidden bg-bg px-[max(1.25rem,env(safe-area-inset-left))] py-[max(1.25rem,env(safe-area-inset-top))]"
    >
      <div className="splash-grid absolute inset-0" aria-hidden="true" />
      <div className="splash-glow absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 flex w-full max-w-[min(34rem,100%)] flex-col items-center text-center">
        <div className="splash-logo-wrap flex flex-col items-center">
          <Image
            src="/brand/sqrt-fund-logo.png"
            alt=""
            width={220}
            height={88}
            priority
            aria-hidden="true"
            className="h-auto w-[clamp(9rem,42vw,15rem)] object-contain"
          />
          <div className="mt-5 h-1 w-[min(16rem,70vw)] border border-primary/40 bg-surface">
            <div className="splash-progress h-full bg-primary" aria-hidden="true" />
          </div>
        </div>

        <div className="splash-tagline mt-8 space-y-3">
          <p className="role-label text-xs sm:text-sm text-foreground">
            {splashCopy.tagline}
          </p>
          <p className="role-label text-xs text-primary">
            {splashCopy.eventLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
