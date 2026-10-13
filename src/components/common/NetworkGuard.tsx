"use client";

import React from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";

export function NetworkGuard({ children }: { children?: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;

  if (isWrongNetwork) {
    return (
      <div className="w-full bg-amber-500/10 border-b border-amber-500/30 text-amber-300 px-4 py-2 text-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            Wrong network detected (Chain ID: {chainId}). SqrtFund requires <strong>Avalanche Fuji (43113)</strong>.
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
          disabled={isPending}
          className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs py-1 h-auto"
        >
          {isPending ? "Switching..." : "Switch to Fuji"}
        </Button>
      </div>
    );
  }

  return children ? <>{children}</> : null;
}
