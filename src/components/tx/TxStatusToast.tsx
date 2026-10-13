import React from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { ExplorerLink } from "./ExplorerLink";

export type TxStepState = "idle" | "signing" | "confirming" | "success" | "error";

export interface TxStatusDisplayProps {
  status: TxStepState;
  txHash?: string;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
}

export function TxStatusDisplay({
  status,
  txHash,
  errorMessage,
  onRetry,
  className = "",
}: TxStatusDisplayProps) {
  if (status === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border p-4 text-xs transition-all ${
        status === "success"
          ? "border-money/30 bg-money/10 text-money"
          : status === "error"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-line-strong bg-bg text-foreground"
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 font-medium">
        {status === "signing" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Waiting for wallet signature in MetaMask...</span>
          </>
        )}
        {status === "confirming" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            <span>Confirming transaction on Avalanche Fuji...</span>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-4 w-4 text-money" />
            <span className="font-semibold text-foreground">Transaction confirmed successfully!</span>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              {errorMessage || "Transaction was rejected or failed"}
            </span>
          </>
        )}
      </div>

      {txHash && (
        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2">
          <span className="text-muted">Transaction hash:</span>
          <ExplorerLink txHash={txHash} />
        </div>
      )}

      {status === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-xs font-semibold text-primary underline hover:text-foreground"
        >
          Try transaction again
        </button>
      )}
    </div>
  );
}
