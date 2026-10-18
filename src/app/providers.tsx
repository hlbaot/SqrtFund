"use client";

import React, { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { LocaleProvider } from "@/lib/context/locale";
import { ToastProvider } from "@/lib/context/toast";
import { WalletWatcher } from "@/components/common/WalletWatcher";
import { ToastContainer } from "@/components/ui/Toast";
import { isWalletLoggedOut } from "@/lib/walletSession";
import type { Locale } from "@/lib/copy";
import { defaultQueryPolicy } from "@/lib/queryPolicy";

export function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [reconnectOnMount] = useState(() => {
    const loggedOut = isWalletLoggedOut();
    console.log("[LOGOUT_DEBUG] Providers mount: isWalletLoggedOut() =", loggedOut, "reconnectOnMount =", !loggedOut);
    return !loggedOut;
  });
  const [initialState] = useState(() => ({
    ...wagmiConfig.state,
    connections: reconnectOnMount ? wagmiConfig.state.connections : new Map(),
    current: reconnectOnMount ? wagmiConfig.state.current : null,
    status: reconnectOnMount ? "reconnecting" as const : "disconnected" as const,
  }));
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: defaultQueryPolicy,
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState} reconnectOnMount={reconnectOnMount}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider initialLocale={initialLocale}>
          <ToastProvider>
            <WalletWatcher />
            {children}
            <ToastContainer />
          </ToastProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
