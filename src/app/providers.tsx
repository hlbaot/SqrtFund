"use client";

import React, { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { LocaleProvider } from "@/lib/context/locale";
import { ToastProvider } from "@/lib/context/toast";
import { ToastContainer } from "@/components/ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 5_000,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
