"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { NavLink } from "./NavLink";
import { useRound } from "@/hooks/useRound";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "./NotificationBell";
import { NetworkGuard } from "@/components/common/NetworkGuard";
import { defaultWalletProfile, useWalletProfile } from "@/hooks/useWalletProfile";
import { ArrowRight, Menu, X } from "lucide-react";

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
  const { roundAddress, status, isLoading: isRoundLoading, isError: isRoundError } = useRound();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setPendingHref(null);
  }
  const [showAnnouncement, setShowAnnouncement] = useState(true);

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
      {showAnnouncement && (
        <div className="border-b border-line bg-surface">
          <Container className="flex min-h-9 items-center justify-between gap-3">
            <div className="mono-label flex min-w-0 items-center gap-2 text-muted text-xs">
              <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${status === "finalized" ? "text-money" : "text-primary"}`} aria-hidden="true" />
              <span className={`truncate ${status === "finalized" ? "text-money" : status === "open" ? "text-primary" : "text-muted"}`}>
                {isRoundLoading ? t.common.loading : isRoundError ? t.competition.roundReadHint : !roundAddress ? t.competition.noRounds : status === "cancelled" ? t.phase2.cancelled : status === "finalized"
                  ? t.nav.announcementFinalized
                  : status === "closed"
                    ? t.nav.announcementClosed
                    : t.nav.announcementOpen}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAnnouncement(false)}
              className="mono-label px-2 py-1 text-muted hover:text-foreground hover:bg-surface-2 cursor-pointer transition-colors rounded-xs text-xs"
              aria-label={t.nav.dismissAnnouncement}
            >
              x
            </button>
          </Container>
        </div>
      )}
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs cursor-pointer transition-opacity hover:opacity-85 active:scale-95"
          aria-label={t.nav.homeAria}
        >
          <Image
            src="/brand/sqrt-fund-logo.png"
            alt="SqrtFund"
            width={58}
            height={40}
            priority
            className="h-8 w-auto object-contain lg:h-10"
          />
        </Link>

        <nav
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
          <LanguageToggle />
          <ConnectWalletButton />
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
