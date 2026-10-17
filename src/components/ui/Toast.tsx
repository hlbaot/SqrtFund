"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useToast } from "@/lib/context/toast";
import { useLocale } from "@/lib/context/locale";
import { CheckCircle2, AlertCircle, Info, Loader2, X, ExternalLink } from "lucide-react";
import { getExplorerTxUrl, shortAddress } from "@/lib/format";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();
  const { t } = useLocale();

  if (toasts.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 left-4 z-[2147483647] flex flex-col gap-2 pointer-events-none w-[calc(100vw-2rem)] max-w-sm"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const isPending = toast.type === "pending";

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 border p-4 transition-all ${
              isSuccess
                ? "bg-bg/95 border-money/40 text-foreground"
                : isError
                ? "bg-bg/95 border-primary/40 text-foreground"
                : isPending
                ? "bg-bg/95 border-amber-500/40 text-foreground"
                : "bg-bg/95 border-line-strong text-foreground"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="h-5 w-5 text-money" />}
              {isError && <AlertCircle className="h-5 w-5 text-primary" />}
              {isPending && <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />}
              {toast.type === "info" && <Info className="h-5 w-5 text-muted" />}
            </div>

            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  {toast.description}
                </p>
              )}
              {toast.txHash && (
                <a
                  href={getExplorerTxUrl(toast.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-money hover:underline"
                >
                  <span>Snowtrace: {shortAddress(toast.txHash, 6)}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              aria-label={t.transactions.dismiss}
              type="button"
              className="shrink-0 rounded p-1 text-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>, document.body
  );
}
