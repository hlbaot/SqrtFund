"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/context/locale";
import { isTourCompleted, startOnboardingTour } from "@/lib/onboardingTour";

export function AutoOnboardingTour() {
  const { locale } = useLocale();
  const startedRef = useRef(false);

  useEffect(() => {
    // User cũ đã xem/hoàn thành tour thì bỏ qua
    if (isTourCompleted()) return;

    const launch = () => {
      if (startedRef.current) return;
      if (isTourCompleted()) return;
      startedRef.current = true;
      startOnboardingTour(locale);
    };

    // Splash đang chạy thì chờ xong
    const isSplashActive =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("splash-active");

    let timer: NodeJS.Timeout;

    if (isSplashActive) {
      const onSplashFinished = () => {
        timer = setTimeout(launch, 350);
      };
      window.addEventListener("splash-intro-finished", onSplashFinished, { once: true });

      // Timer dự phòng: splash treo/lâu thì chạy tour sau 3.2s
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
      // Không có splash: chạy tour sau khi DOM ổn định
      timer = setTimeout(launch, 500);
      return () => clearTimeout(timer);
    }
  }, [locale]);

  return null;
}
