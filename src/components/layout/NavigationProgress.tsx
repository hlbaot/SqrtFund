"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "@/lib/context/locale";
import { isRouteNavigation } from "@/lib/navigationProgress";

export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { locale } = useLocale();
  const [active, setActive] = useState(false);
  useEffect(() => { setActive(false); }, [pathname, search]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const start = (href: string) => {
      const current = new URL(window.location.href);
      if (!isRouteNavigation(new URL(href, current), current)) return;
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), 15_000);
    };
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      start(link.href);
    };
    const custom = (event: Event) => { const href = (event as CustomEvent<string>).detail; if (typeof href === "string") start(href); };
    // Capture before next/link prevents the native navigation event.
    document.addEventListener("click", click, true);
    window.addEventListener("sqrt-route-start", custom);
    return () => { clearTimeout(timer); document.removeEventListener("click", click, true); window.removeEventListener("sqrt-route-start", custom); };
  }, []);
  if (!active) return null;
  return <div role="progressbar" aria-label={locale === "vi" ? "Đang chuyển trang" : "Loading page"} className="pointer-events-none fixed inset-x-0 top-0 z-[2147483647] h-1 overflow-hidden bg-primary/15"><div className="navigation-progress h-full w-3/4 bg-primary" /></div>;
}
