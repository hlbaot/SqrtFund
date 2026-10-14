"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import AOS from "aos";
import "aos/dist/aos.css";

export function AOSInit() {
  const pathname = usePathname();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const isHome = pathname === "/";

    const triggerAOS = () => {
      if (!isInitializedRef.current) {
        AOS.init({
          duration: 700,
          easing: "ease-out-cubic",
          once: true,
          offset: 40,
          delay: 50,
        });
        isInitializedRef.current = true;
      } else {
        AOS.refreshHard();
      }
    };

    // If on home, check if splash intro is currently active in the DOM
    const splashEl = typeof document !== "undefined" ? document.querySelector(".splash-intro") : null;
    if (isHome && splashEl) {
      let fired = false;
      const onSplashFinish = () => {
        if (fired) return;
        fired = true;
        window.removeEventListener("splash-intro-finished", onSplashFinish);
        // Small delay to ensure the splash overlay is completely gone from view
        setTimeout(() => {
          triggerAOS();
        }, 80);
      };

      window.addEventListener("splash-intro-finished", onSplashFinish);

      // Safety fallback in case event was missed or delayed
      const fallbackTimer = setTimeout(() => {
        onSplashFinish();
      }, 3500);

      return () => {
        window.removeEventListener("splash-intro-finished", onSplashFinish);
        clearTimeout(fallbackTimer);
      };
    } else {
      // Non-home page or splash already dismissed
      triggerAOS();
    }
  }, [pathname]);

  return null;
}
