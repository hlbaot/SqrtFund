"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/context/locale";
import { useRound } from "@/hooks/useRound";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { LanguageToggle } from "./LanguageToggle";
import { NetworkGuard } from "@/components/common/NetworkGuard";
import { ArrowRight, Menu, X } from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { roundAddress, status } = useRound();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  const navLinks = [
    { href: "/", label: t.nav.home },
    { href: "/register", label: t.nav.register },
    { href: "/my", label: t.nav.my },
    { href: "/admin", label: t.nav.admin },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-bg/95 backdrop-blur-md">
      <NetworkGuard />
      {showAnnouncement && roundAddress && (
        <div className="border-b border-line bg-surface">
          <div className="mx-auto flex min-h-9 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="mono-label flex min-w-0 items-center gap-2 text-muted text-xs">
              <ArrowRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="truncate">
                {status === "finalized"
                  ? "Round finalized — Results and claims are open"
                  : status === "closed"
                  ? "Round closed — Finalization pending"
                  : "Active Round live on Avalanche Fuji"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAnnouncement(false)}
              className="mono-label px-2 py-1 text-muted hover:text-foreground text-xs"
              aria-label="Dismiss round status announcement"
            >
              x
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-stretch justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center border-x border-line px-3 focus:outline-none"
          aria-label="SqrtFund Home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/sqrt-fund-logo.png"
            alt="√Fund"
            className="h-12 w-auto object-contain"
          />
        </Link>

        <nav
          className="hidden items-stretch text-sm font-medium md:flex"
          aria-label="Primary Navigation"
        >
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/" || pathname.startsWith("/round")
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`mono-label relative flex items-center border-r border-line px-5 transition-colors first:border-l ${
                  isActive
                    ? "gradient-border border-x-0 border-b-0 bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <LanguageToggle />
          <ConnectWalletButton />
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="border border-line p-2 text-muted hover:bg-surface-2 hover:text-foreground focus:outline-none"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="space-y-3 border-b border-line bg-bg px-4 py-4 sm:hidden">
          <nav className="flex flex-col space-y-2" aria-label="Mobile Navigation">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/" || pathname.startsWith("/round")
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`mono-label border px-3 py-2 ${
                    isActive
                      ? "gradient-border text-foreground font-bold"
                      : "border-line bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line pt-2">
            <ConnectWalletButton />
          </div>
        </div>
      )}
    </header>
  );
}

// Re-export as Header for backward compatibility
export const Header = Navbar;
