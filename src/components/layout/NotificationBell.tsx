"use client";

import React, { useState, useRef, useEffect, useId, useMemo, useCallback } from "react";
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
  Wallet,
} from "lucide-react";
import styles from "./NotificationBell.module.css";

export function NotificationBell() {
  const { t, locale } = useLocale();
  const vi = locale === "vi";
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
  const [isClosing, setIsClosing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [position, setPosition] = useState({ top: 0, right: 16 });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const reposition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth < 640 ? 8 : Math.min(Math.max(8, window.innerWidth - rect.right), Math.max(8, window.innerWidth - 368)),
      });
    }
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    triggerRef.current?.focus();
  }, []);

  const togglePanel = () => {
    if (isOpen) { closePanel(); return; }
    // Measure before mounting the portal; never animate from default coordinates.
    reposition();
    setIsClosing(false);
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isClosing) return;
    const timer = window.setTimeout(() => setIsClosing(false), 100);
    return () => window.clearTimeout(timer);
  }, [isClosing]);

  // Position calculation and outside click/escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        closePanel();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
      if (event.key === "Tab") {
        const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };

    panelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
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
  }, [isOpen, reposition, closePanel]);

  const displayedEntries = useMemo(() => {
    return filter === "unread" ? unreadEntries : entries;
  }, [filter, unreadEntries, entries]);

  const handleEntryClick = (entry: NotificationEntry) => {
    if (!entry.isRead) {
      markAsRead(entry.key);
    }
    closePanel();
  };

  const renderIcon = (type: NotificationEntry["type"]) => {
    switch (type) {
      case "round_ended":
        return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Clock className="h-4 w-4" /></span>;
      case "round_finalized":
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
        onClick={togglePanel}
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
            <span className="relative inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 font-mono text-xs font-bold leading-none text-white shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {(isOpen || isClosing) &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="dialog"
            data-state={isOpen ? "open" : "closed"}
            aria-hidden={!isOpen}
            inert={!isOpen}
            aria-label={t.notifications.title}
            style={
              {
                "--bell-top": `${position.top}px`,
                "--bell-right": `${position.right}px`,
              } as React.CSSProperties
            }
            className={`${styles.panel} fixed right-[var(--bell-right)] top-[var(--bell-top)] z-50 flex w-[360px] max-w-[calc(100vw-1rem)] max-h-[70vh] flex-col origin-top-right rounded-lg border border-line bg-bg text-[13px] text-foreground shadow-2xl overflow-hidden`}
          >
            <div className="flex shrink-0 items-center justify-between gap-1 border-b border-line bg-surface/80 px-3 py-2">
              <div className="flex min-w-0 items-center gap-1">
                <Bell className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="shrink-0 whitespace-nowrap text-[13px] font-semibold">{t.notifications.title}</h3>
                {unreadCount > 0 && (
                  <span title={`${unreadCount} ${t.notifications.unread.toLowerCase()}`} className="min-w-0 truncate whitespace-nowrap rounded bg-primary/15 px-1 text-xs text-primary">
                    {unreadCount} {t.notifications.unread.toLowerCase()}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllAsRead} title={t.notifications.markAllRead} aria-label={t.notifications.markAllRead}
                    className="flex items-center gap-1 whitespace-nowrap rounded px-1 py-1 text-xs text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline focus-visible:outline-primary">
                    <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{t.notifications.markRead}</span>
                  </button>
                )}
                <button type="button" onClick={closePanel} aria-label={vi ? "Đóng thông báo" : "Close notifications"}
                  className="shrink-0 rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline focus-visible:outline-primary">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs if there are notifications */}
            {isConnected && totalCount > 0 && (
              <div className="flex shrink-0 flex-nowrap whitespace-nowrap border-b border-line bg-surface/30 px-3 py-1 gap-2">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  aria-pressed={filter === "all"}
                  className={`rounded px-2.5 py-1 text-xs transition-colors cursor-pointer ${
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
                  aria-pressed={filter === "unread"}
                  className={`rounded px-2.5 py-1 text-xs transition-colors cursor-pointer ${
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
            <div className={`${styles.list} min-h-0 flex-1 overflow-y-auto divide-y divide-line/40 overscroll-contain`}>
              {!isConnected ? (
                <div className="flex flex-col items-center justify-center px-3 py-5 text-center space-y-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 border border-line text-muted">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-xs">
                      {t.notifications.walletPrompt}
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      {t.notifications.walletPromptDesc}
                    </p>
                  </div>
                </div>
              ) : displayedEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-3 py-5 text-center space-y-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 border border-line text-muted/60">
                    <BellOff className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground text-xs">
                      {vi ? "Chưa có thông báo" : "No notifications"}
                    </p>
                  </div>
                </div>
              ) : (
                displayedEntries.map(entry => (
                  <Link
                    key={entry.key}
                    href={entry.href}
                    onClick={() => handleEntryClick(entry)}
                    title={`${entry.title}: ${entry.description}`}
                    className={`group flex min-w-0 items-center gap-2 px-3 py-2 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-primary ${
                      !entry.isRead
                        ? "bg-surface-2/60 hover:bg-surface-2"
                        : "hover:bg-surface/60"
                    }`}
                  >
                    {renderIcon(entry.type)}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span title={entry.title} className="min-w-0 font-semibold text-foreground truncate">
                          {entry.title}
                        </span>
                        {!entry.isRead && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-primary"
                            title={t.notifications.unread}
                          />
                        )}
                      </div>
                      <p title={entry.description} className="text-[13px] leading-snug text-muted line-clamp-1 break-words [overflow-wrap:anywhere]">
                        {entry.description}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Footer with Quick Links */}
            {isConnected && (
              <div className="flex shrink-0 min-w-0 items-center justify-between gap-2 whitespace-nowrap border-t border-line bg-surface/50 px-3 py-2 text-xs">
                <Link
                  href="/my"
                  onClick={closePanel}
                  className="min-w-0 truncate whitespace-nowrap text-muted hover:text-foreground hover:underline transition-colors cursor-pointer"
                >
                  {t.notifications.viewMyActivity} &rarr;
                </Link>
                {(isAdmin || isPlatformOwner || isOrganizer) && (
                  <Link
                    href={isPlatformOwner ? "/admin?tab=platform" : "/admin?tab=organizer"}
                    onClick={closePanel}
                    title={t.notifications.adminDashboard}
                    className="min-w-0 truncate whitespace-nowrap text-primary hover:underline transition-colors cursor-pointer"
                  >
                    {vi ? "Quản trị" : "Admin"} &rarr;
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
