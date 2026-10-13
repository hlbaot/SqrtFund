import React from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";
import { Frame } from "@/components/ui/Frame";

export interface ErrorStateProps {
  title?: string;
  reason: string;
  solution?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "Unable to load data",
  reason,
  solution = "Check network connectivity or switch to Avalanche Fuji testnet in your wallet, then reload.",
  onRetry,
  retryLabel = "Try again",
}: ErrorStateProps) {
  return (
    <Frame
      role="alert"
      className="flex flex-col items-center justify-center border-primary/40 bg-primary/10 px-6 py-12 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm font-medium text-foreground">
        {reason}
      </p>
      {solution && (
        <p className="mt-1 max-w-md text-xs text-muted">
          {solution}
        </p>
      )}
      {onRetry && (
        <div className="mt-6">
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </Frame>
  );
}
