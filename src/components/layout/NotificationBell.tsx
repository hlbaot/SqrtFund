"use client";

import React, { useState, useRef, useEffect, useId, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useNotifications, type NotificationEntry } from "@/hooks/useNotifications";
import { useLocale } from "@/lib/context/locale";
import { useRole } from "@/hooks/useRole";
import {
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  ShieldCheck,
  ShieldAlert,
  X,
  ChevronRight,
  Wallet,
} from "lucide-react";

export function NotificationBell() {
  const { t } = useLocale();
  const { isConnected, isAdmin, isPlatformOwner, isOrganizer } = useRole();
  const {
    entries,
    unreadEntries,
    unreadCount,
    totalCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [position, setPosition] = useState({ top: 0, right: 16 });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  // Position calculation and outside click/escape listener
  useEffect(() => {
    if (!isOpen) return;

    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        setPosition({
          top: rect.bottom + 8,
          right: Math.max(12, window.innerWidth - rect.right),
        });
      }
    };

    reposition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const displayedEntries = useMemo(() => {
    return filter === "unread" ? unreadEntries : entries;
  }, [filter, unreadEntries, entries]);

  const handleEntryClick = (entry: NotificationEntry) => {
    if (!entry.isRead) {
      markAsRead(entry.key);
    }
    setIsOpen(false);
  };

  const renderIcon = (type: NotificationEntry["type"]) => {
    switch (type) {
      case "project_approved":
        return (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-money/15 text-money">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        );
      case "organizer_rejected":
      case "project_rejected":
        return (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertCircle className="h-4 w-4" />
          </span>
        );
      case "project_pending":
        return (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Clock className="h-4 w-4" />
          </span>
        );
      case "claim":
      case "refund":
        return (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Coins className="h-4 w-4" />
          </span>
        );
      case "organizer_revoked":
        return (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldAlert className="h-4 w-4" />
          </span>
        );
      case "organizer_approved":
      default:
        return (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
        );
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={
          unreadCount > 0
            ? `${unreadCount} ${t.notifications.badge}`
            : t.notifications.title
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={menuId}
        className={`relative flex items-center justify-center p-2 text-muted transition-colors cursor-pointer active:scale-95 hover:text-foreground focus-visible:outline-none ${
          isOpen ? "text-foreground" : ""
        }`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold leading-none text-white shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="dialog"
            aria-label={t.notifications.title}
            style={
              {
                "--bell-top": `${position.top}px`,
                "--bell-right": `${position.right}px`,
              } as React.CSSProperties
            }
            className="fixed right-[var(--bell-right)] top-[var(--bell-top)] z-50 flex w-[380px] max-w-[calc(100vw-1.5rem)] max-h-[min(540px,calc(100dvh-var(--bell-top)-1rem))] flex-col rounded-lg border border-line bg-bg font-mono text-xs text-foreground shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line bg-surface/80 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-semibold text-foreground text-sm tracking-tight">
                  {t.notifications.title}
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/20 border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {unreadCount} {t.notifications.unread.toLowerCase()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    title={t.notifications.markAllRead}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer transition-colors"
                  >
                    <CheckCheck className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">
                      {t.notifications.markAllRead}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs if there are notifications */}
            {isConnected && totalCount > 0 && (
              <div className="flex border-b border-line bg-surface/30 px-3 py-1.5 gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
                    filter === "all"
                      ? "bg-surface-2 text-foreground font-semibold"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t.notifications.all} ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("unread")}
                  className={`rounded px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
                    filter === "unread"
                      ? "bg-surface-2 text-foreground font-semibold"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {t.notifications.unread} ({unreadCount})
                </button>
              </div>
            )}

            {/* List / Empty States */}
            <div className="flex-1 overflow-y-auto divide-y divide-line/40 overscroll-contain">
              {!isConnected ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 border border-line text-muted">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-xs">
                      {t.notifications.walletPrompt}
                    </p>
                    <p className="text-[11px] text-muted leading-relaxed">
                      {t.notifications.walletPromptDesc}
                    </p>
                  </div>
                </div>
              ) : displayedEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 border border-line text-muted/60">
                    <BellOff className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-xs">
                      {filter === "unread"
                        ? t.notifications.emptyTitle
                        : t.notifications.emptyTitle}
                    </p>
                    <p className="text-[11px] text-muted leading-relaxed">
                      {t.notifications.emptyDesc}
                    </p>
                  </div>
                </div>
              ) : (
                displayedEntries.map(entry => (
                  <Link
                    key={entry.key}
                    href={entry.href}
                    onClick={() => handleEntryClick(entry)}
                    className={`group flex items-start gap-3 p-3.5 transition-colors cursor-pointer ${
                      !entry.isRead
                        ? "bg-surface-2/60 hover:bg-surface-2"
                        : "hover:bg-surface/60"
                    }`}
                  >
                    {renderIcon(entry.type)}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {entry.title}
                        </span>
                        {!entry.isRead && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-primary"
                            title={t.notifications.unread}
                          />
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted line-clamp-2">
                        {entry.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted self-center" />
                  </Link>
                ))
              )}
            </div>

            {/* Footer with Quick Links */}
            {isConnected && (
              <div className="flex items-center justify-between border-t border-line bg-surface/50 px-4 py-2.5 text-[11px]">
                <Link
                  href="/my"
                  onClick={() => setIsOpen(false)}
                  className="text-muted hover:text-foreground hover:underline transition-colors cursor-pointer"
                >
                  {t.notifications.viewMyActivity} &rarr;
                </Link>
                {(isAdmin || isPlatformOwner || isOrganizer) && (
                  <Link
                    href={isPlatformOwner ? "/admin?tab=platform" : "/admin?tab=organizer"}
                    onClick={() => setIsOpen(false)}
                    className="text-primary hover:underline transition-colors cursor-pointer"
                  >
                    {t.notifications.adminDashboard} &rarr;
                  </Link>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
