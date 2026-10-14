"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { copy } from "@/lib/copy";

const splashCopy = copy.en.splashIntro;

export function SplashIntro() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [dismissed, setDismissed] = useState(false);

  const finishSplash = () => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("splash-active");
    }
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("splash-intro-finished"));
    }
  };

  useEffect(() => {
    if (!isHome || dismissed) {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("splash-active");
      }
      return;
    }

    if (typeof document !== "undefined") {
      document.documentElement.classList.add("splash-active");
    }
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }

    const preventScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const preventKeyScroll = (e: KeyboardEvent) => {
      const scrollKeys = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
        " ",
        "PageUp",
        "PageDown",
        "End",
        "Home",
      ];
      if (scrollKeys.includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", preventKeyScroll, { passive: false });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? 800 : 3000;
    const finishTimer = window.setTimeout(finishSplash, duration);

    return () => {
      window.clearTimeout(finishTimer);
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener("keydown", preventKeyScroll);
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("splash-active");
      }
    };
  }, [isHome, dismissed]);

  if (!isHome || dismissed) return null;

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
          <p className="mono-label text-[clamp(0.68rem,2.2vw,0.82rem)] text-foreground">
            {splashCopy.tagline}
          </p>
          <p className="mono-label text-[clamp(0.62rem,2vw,0.75rem)] text-primary">
            {splashCopy.eventLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
