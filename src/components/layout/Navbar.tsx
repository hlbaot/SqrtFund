"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { NavLink } from "./NavLink";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { NetworkGuard } from "@/components/common/NetworkGuard";
import { defaultWalletProfile, useWalletProfile } from "@/hooks/useWalletProfile";
import { Menu, X } from "lucide-react";

import { Container } from "./Container";

export function Navbar() {
  const pathname = usePathname();
  const {
    role,
    isReady,
    isConnected,
    isPlatformOwner,
    isOrganizer,
    isRoundAdmin,
    canCreateRound,
    isAdmin,
    isStudent,
    address,
    chainId,
  } = useRole();
  const isOrgRole = Boolean(isOrganizer || isPlatformOwner || isRoundAdmin || canCreateRound || isAdmin || (role as string) === "organizer" || role === "admin");
  const { profile } = useWalletProfile(address, chainId, defaultWalletProfile(isOrgRole, Boolean(isStudent)));
  const isOrganizerUser = isConnected && (isPlatformOwner || profile === "organizer" || (!isStudent && isOrgRole) || (profile !== "student" && isOrgRole));
  const counts = useNotificationCounts(isReady ? role : "guest");
  const { t } = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setPendingHref(null);
  }

  const dashboardHref = isPlatformOwner ? "/admin?tab=platform" : "/admin?tab=organizer";
  const navLinks = [
    { href: "/", label: t.nav.home },
    { href: "/round", label: t.nav.round },
    ...(isConnected && !isPlatformOwner && !isOrganizerUser ? [
      { href: "/register", label: t.nav.register },
    ] : []),
    ...(!isPlatformOwner ? [
      { href: "/my", label: t.nav.my },
    ] : []),
    ...(isConnected && isPlatformOwner ? [{ href: dashboardHref, label: t.nav.platformDashboard }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-bg/95 backdrop-blur-md">
      <NetworkGuard />
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link
          id="tour-brand"
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs cursor-pointer transition-opacity hover:opacity-85 active:scale-95"
          aria-label={t.nav.homeAria}
        >
          <Image
            src="/brand/logo_sqrtfund.png"
            alt="SqrtFund"
            width={128}
            height={64}
            priority
            className="h-7 w-auto object-contain sm:h-8 lg:h-9"
          />
        </Link>

        <nav
          id="tour-nav"
          className="hidden items-center gap-1 text-sm font-medium xl:flex"
          aria-label={t.nav.primaryNavigation}
        >
          {navLinks.map(link => (
            <NavLink key={link.href} {...link} pathname={pathname} pendingHref={pendingHref}
              count={link.href === dashboardHref ? counts.admin : link.href === "/my" ? counts.activity : 0}
              onNavigate={href => { if (href === "/my") counts.markAllSeen(); setPendingHref(href); }} />
          ))}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <NotificationBell />
          <div id="tour-language">
            <LanguageToggle />
          </div>
          <div id="tour-wallet">
            <ConnectWalletButton />
          </div>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-h-10 min-w-10 border border-line p-2 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer transition-colors active:scale-95 focus:outline-none"
            aria-label={mobileMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {mobileMenuOpen && (
        <div className="border-b border-line bg-bg xl:hidden">
          <Container className="py-4 space-y-4">
            <nav className="flex flex-col space-y-1.5" aria-label={t.nav.mobileNavigation}>
              {navLinks.map(link => (
                <NavLink key={link.href} {...link} mobile pathname={pathname} pendingHref={pendingHref}
                  count={link.href === dashboardHref ? counts.admin : link.href === "/my" ? counts.activity : 0}
                  onNavigate={href => { if (href === "/my") counts.markAllSeen(); setPendingHref(href); setMobileMenuOpen(false); }} />
              ))}
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <LanguageToggle />
              <ConnectWalletButton />
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}

// Re-export as Header for backward compatibility
export const Header = Navbar;

