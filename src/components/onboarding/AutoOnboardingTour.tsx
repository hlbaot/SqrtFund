"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/context/locale";
import { isTourCompleted, startOnboardingTour } from "@/lib/onboardingTour";

export function AutoOnboardingTour() {
  const { locale } = useLocale();
  const startedRef = useRef(false);

  useEffect(() => {
    // If returning user has already completed or seen the tour, do nothing
    if (isTourCompleted()) return;

    const launch = () => {
      if (startedRef.current) return;
      if (isTourCompleted()) return;
      startedRef.current = true;
      startOnboardingTour(locale);
    };

    // If splash screen is currently active, wait until it finishes
    const isSplashActive =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("splash-active");

    let timer: NodeJS.Timeout;

    if (isSplashActive) {
      const onSplashFinished = () => {
        timer = setTimeout(launch, 350);
      };
      window.addEventListener("splash-intro-finished", onSplashFinished, { once: true });

      // Fallback timer: if splash intro somehow hangs or takes longer, launch after 3.2s
      const fallbackTimer = setTimeout(() => {
        window.removeEventListener("splash-intro-finished", onSplashFinished);
        launch();
      }, 3200);

      return () => {
        clearTimeout(timer);
        clearTimeout(fallbackTimer);
        window.removeEventListener("splash-intro-finished", onSplashFinished);
      };
    } else {
      // No splash active (or fast render) -> launch tour after brief DOM stabilization
      timer = setTimeout(launch, 500);
      return () => clearTimeout(timer);
    }
  }, [locale]);

  return null;
}
