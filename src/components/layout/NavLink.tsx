"use client";

import Link from "next/link";
import { GradientBorder } from "@/components/ui/GradientBorder";
import { NotificationBadge } from "@/components/ui/NotificationBadge";
import { matchesNavRoute } from "@/lib/navigation";

export function NavLink({ href, label, pathname, pendingHref, count, mobile, onNavigate }: {
  href: string;
  label: string;
  pathname: string;
  pendingHref: string | null;
  count: number;
  mobile?: boolean;
  onNavigate: (href: string) => void;
}) {
  const current = matchesNavRoute(pathname, href);
  const selected = pendingHref ? pendingHref === href : current;
  return (
    <GradientBorder className={`nav-border rounded-sm ${selected ? "nav-selected" : ""}`}>
      <Link href={href} aria-current={current ? "page" : undefined} onClick={event => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate(href);
      }} className={`mono-label relative flex items-center gap-2 whitespace-nowrap rounded-sm font-medium focus-visible:outline-none ${mobile ? "min-h-11 px-3.5 py-2.5" : "px-4 py-2"} ${selected ? "text-foreground" : "text-muted hover:text-foreground"}`}>
        {label}
        {count > 0 && <span className="absolute -right-1.5 -top-1.5 z-10"><NotificationBadge count={count} /></span>}
      </Link>
    </GradientBorder>
  );
}
