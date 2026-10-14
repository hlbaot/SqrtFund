"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/hooks/useRole";
import { useLocale } from "@/lib/context/locale";
import { txToast } from "@/lib/txToast";
import { logoutWallet, reloadWallet, saveSessionValue, takeSessionValue, walletChanged, WALLET_SNAPSHOT_KEY, type WalletSnapshot } from "@/lib/walletSession";

export function WalletWatcher() {
  const { address, status, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const { role, isReady } = useRole();
  const { disconnectAsync } = useDisconnect();
  const queryClient = useQueryClient();
  const { t } = useLocale();
  const previous = useRef<WalletSnapshot | null>(null);

  useEffect(() => {
    if (status === "reconnecting" || status === "connecting") return;
    const next = { address: address?.toLowerCase() ?? null, chainId, role };
    // A mounted page always establishes a fresh baseline after rehydration.
    // Stored snapshots are never consulted for permissions.
    if (!previous.current) {
      if (!isReady) return;
      previous.current = next;
      saveSessionValue(WALLET_SNAPSHOT_KEY, JSON.stringify(next));
      if (takeSessionValue("sqrt-fund:wallet-connected")) txToast.success("wallet-connect", t.wallet.connected);
      return;
    }
    if (previous.current.address && status === "disconnected") {
      void logoutWallet(disconnectAsync, queryClient).catch(() => { });
      return;
    }
    // Account/network changes cancel immediately; wait for role reads before role comparison.
    const identityChanged = previous.current.address !== next.address || previous.current.chainId !== next.chainId;
    if (!identityChanged && !isReady) return;
    if (!identityChanged && !walletChanged(previous.current, next)) return;
    if (!previous.current.address && next.address) saveSessionValue("sqrt-fund:wallet-connected", "1");
    previous.current = next;
    reloadWallet(next);
  }, [address, status, chainId, role, isReady, disconnectAsync, queryClient, t.wallet.connected]);
  return null;
}
