"use client";

import React, { useEffect } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { useLocale } from "@/lib/context/locale";
import { txToast } from "@/lib/txToast";
import { getContractErrorMessage } from "@/lib/errors";

export function NetworkGuard({ children }: { children?: React.ReactNode; }) {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const { t, locale } = useLocale();
  const isWrongNetwork = isConnected && chainId !== TARGET_CHAIN_ID;
  useEffect(() => { if (!isWrongNetwork) txToast.dismiss("wallet-network"); }, [isWrongNetwork]);
  if (!isWrongNetwork) return children ? <>{children}</> : null;
  return (
    <div role="status" className="flex w-full flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{t.wallet.wrongNetwork}</span></div>
      <Button size="sm" variant="secondary" disabled={isPending} isLoading={isPending} onClick={async () => {
        try { await switchChainAsync({ chainId: TARGET_CHAIN_ID }); }
        catch (error) { txToast.error("wallet-network", t.wallet.switchFailed, getContractErrorMessage(error, locale)); }
      }}>{isPending ? t.wallet.switching : t.wallet.switchNetwork}</Button>
    </div>
  );
}
