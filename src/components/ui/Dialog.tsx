"use client";

import React, { useEffect } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { X } from "lucide-react";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={twMerge(
          clsx(
            "relative w-full max-w-lg border border-line bg-surface p-6 text-foreground transition-all",
            className
          )
        )}
      >
        <button
          onClick={onClose}
          type="button"
          aria-label="Close dialog"
          className="absolute right-4 top-4 p-1.5 text-muted hover:bg-surface-2 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X className="h-4 w-4" />
        </button>

        {title && (
          <h2 className="text-lg font-bold text-foreground tracking-tight">{title}</h2>
        )}
        {description && (
          <p className="mt-1.5 text-sm text-muted">{description}</p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
