"use client";
import { useUiStoreSync } from "@/hooks/useUiStoreSync";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";
import { REALTIME_EVENT, isRealtimeChange, isNotificationQuery } from "@/lib/realtime";

/** Mount một lần trong Providers, không tạo socket riêng cho mỗi chuông/menu. */
export function RealtimeNotifications() {
  useUiStoreSync();
  const { address, chainId, isConnected } = useAccount();
  const client = useQueryClient();
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url || !isConnected || !address || chainId !== TARGET_CHAIN_ID) return;
    const socket = io(url, { transports: ["websocket"], autoConnect: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      // Gộp các log cùng giao dịch; không tạo một đợt RPC cho từng log.
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.visibilityState !== "visible") return;
        void client.invalidateQueries({ predicate: query => isNotificationQuery(query.queryKey) });
      }, 250);
    };
    socket.on(REALTIME_EVENT, (change: unknown) => { if (isRealtimeChange(change)) refresh(); });
    // Reconnect phải đọc lại snapshot: sự kiện lúc offline có thể đã bị bỏ lỡ.
    socket.on("connect", refresh);
    socket.connect();
    return () => {
      if (timer) clearTimeout(timer);
      socket.disconnect();
    };
  }, [address, chainId, isConnected, client]);
  return null;
}
