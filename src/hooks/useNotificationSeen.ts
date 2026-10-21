"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createNotificationSeenStore, EMPTY_SEEN } from "@/lib/notifications";

const store = createNotificationSeenStore(() => window.localStorage);
const serverSnapshot = () => EMPTY_SEEN;

export function useNotificationSeen(address?: string) {
  const wallet = address?.toLowerCase();
  const subscribe = useCallback((listener: () => void) => store.subscribe(wallet, listener), [wallet]);
  const snapshot = useCallback(() => store.snapshot(wallet), [wallet]);
  const seen = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => {
    if (!wallet) return;
    store.hydrate(wallet);
    const stored = (event: StorageEvent) => {
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
      store.stored(wallet, event.key, event.newValue);
    };
    window.addEventListener("storage", stored);
    return () => window.removeEventListener("storage", stored);
  }, [wallet]);
  const markSeen = useCallback((keys: readonly string[]) => { if (wallet) store.markSeen(wallet, keys); }, [wallet]);
  return { ...seen, markSeen };
}
