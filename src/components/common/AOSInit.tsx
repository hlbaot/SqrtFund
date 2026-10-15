"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import AOS from "aos";
import "aos/dist/aos.css";

export function AOSInit() {
  const pathname = usePathname();
  const isInitializedRef = useRef(false);

  useEffect(() => {
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

    const onIntroFinished = () => { triggerAOS(); };
    window.addEventListener("splash-intro-finished", onIntroFinished);
    if (!document.documentElement.classList.contains("splash-active")) triggerAOS();
    return () => { window.removeEventListener("splash-intro-finished", onIntroFinished); };
  }, [pathname]);

  return null;
}
