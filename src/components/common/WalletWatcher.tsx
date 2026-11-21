"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useDisconnect } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/hooks/useRole";
import {
  isWalletLoggedOut,
  logoutWallet,
  reloadWallet,
  saveSessionValue,
  shouldReload,
  WALLET_SNAPSHOT_KEY,
  type WalletState,
} from "@/lib/walletSession";

export function WalletWatcher() {
  const { address, status, chainId: accountChainId } = useAccount();
  const configChainId = useChainId();
  const chainId = accountChainId ?? configChainId;
  const { role } = useRole();
  const { disconnectAsync } = useDisconnect();
  const queryClient = useQueryClient();
  const prevRef = useRef<WalletState | null>(null);

  useEffect(() => {
    console.log("[LOGOUT_DEBUG] WalletWatcher effect:", { address, status, chainId, role });
    // Bỏ qua trạng thái trung gian tạm thời
    if (status === "connecting" || status === "reconnecting") return;
    if (status === "connected" && isWalletLoggedOut()) {
      void disconnectAsync().catch(() => {});
      return;
    }

    const currentAddress = address ? address.toLowerCase() : null;
    const nextState: WalletState = {
      address: currentAddress,
      status,
      chainId,
      role,
    };

    // Lần đầu thiết lập baseline sau mount
    if (!prevRef.current) {
      prevRef.current = nextState;
      if (currentAddress) {
        saveSessionValue(WALLET_SNAPSHOT_KEY, JSON.stringify(nextState));
      }
      return;
    }

    const prevState = prevRef.current;

    if (shouldReload(prevState, nextState)) {
      prevRef.current = nextState;
      if (prevState.address && (status === "disconnected" || !currentAddress)) {
        // Ngắt kết nối: xoá state ví tại chỗ, không khởi động lại nền trang.
        void logoutWallet(disconnectAsync, queryClient).catch(() => {});
      } else if (
        prevState.address &&
        currentAddress &&
        prevState.address.toLowerCase() !== currentAddress.toLowerCase()
      ) {
        // Đổi account A → B: reload state sạch
        reloadWallet({
          address: currentAddress,
          chainId,
          role: "guest",
        });
      }
      return;
    }

    // Chuyển trạng thái thường, không reload (connect đầu, role loaded, chainId set)
    prevRef.current = nextState;
    if (currentAddress) {
      saveSessionValue(WALLET_SNAPSHOT_KEY, JSON.stringify(nextState));
    }
  }, [address, status, chainId, role, disconnectAsync, queryClient]);

  return null;
}
