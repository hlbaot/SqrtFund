"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import "aos/dist/aos.css";
let initialized = false;

export function AOSInit() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    void import("aos").then(({ default: AOS }) => {
      if (cancelled) return;
      if (!initialized) { AOS.init({ duration: 700, easing: "ease-out-cubic", once: true, offset: 40, delay: 50 }); initialized = true; }
      else AOS.refreshHard();
      document.documentElement.classList.add("aos-ready");
    }).catch(() => { /* Unavailable decoration must never hide the page. */ });
    return () => { cancelled = true; };
  }, [pathname]);

  return null;
}
