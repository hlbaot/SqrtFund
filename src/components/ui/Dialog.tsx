"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";
import { useLocale } from "@/lib/context/locale";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ isOpen, onClose, title, description, children, className }: DialogProps) {
  const { t } = useLocale();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]'
    ) ?? []).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const initial = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
    (initial ?? focusable()[0] ?? panel.current)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        const outside = !panel.current?.contains(document.activeElement);
        if (!first) { event.preventDefault(); panel.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" tabIndex={-1}
        aria-labelledby={title ? titleId : undefined} aria-describedby={description ? descriptionId : undefined}
        className={twMerge(clsx("relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-sm border border-line bg-bg p-4 text-foreground outline-none sm:p-6", className))}>
        <button onClick={onClose} type="button" aria-label={t.common.close}
          className="absolute right-3 top-3 p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        {title && <h2 id={titleId} className="mono-label pr-8 font-bold text-foreground">{title}</h2>}
        {description && <p id={descriptionId} className="mt-1.5 pr-6 text-sm text-muted">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>, document.body
  );
}
