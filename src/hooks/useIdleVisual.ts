"use client";
import { useEffect, useState } from "react";

/** Decorative work starts after a paint, during idle time; it never gates content. */
export function useIdleVisual({ motionOnly = false, desktopOnly = false }: { motionOnly?: boolean; desktopOnly?: boolean } = {}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px)");
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    const eligible = () => (!motionOnly || !reduced.matches) && (!desktopOnly || (desktop.matches && !saveData));
    const reveal = () => { if (alive && eligible()) setReady(true); };
    const schedule = () => {
      if (!eligible()) { setReady(false); return; }
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(reveal, { timeout: 1500 });
      else timer = setTimeout(reveal, 200);
    };
    const frame = requestAnimationFrame(schedule);
    reduced.addEventListener("change", schedule);
    desktop.addEventListener("change", schedule);
    return () => { alive = false; cancelAnimationFrame(frame); if (idle !== undefined) window.cancelIdleCallback(idle); clearTimeout(timer); reduced.removeEventListener("change", schedule); desktop.removeEventListener("change", schedule); };
  }, [motionOnly, desktopOnly]);
  return ready;
}
