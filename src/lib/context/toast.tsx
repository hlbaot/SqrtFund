"use client";

import React, { createContext, useContext, useSyncExternalStore, useCallback, useEffect } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { cancelTransactionFlows } from "@/lib/txToast";
import { txToast, ToastItem as TxToastItem } from "@/lib/txToast";

export type ToastItem = TxToastItem;

const emptyToasts: ToastItem[] = [];
const subscribe = (listener: () => void) => txToast.subscribe(listener);
const getSnapshot = () => txToast.getToasts();
const getServerSnapshot = () => emptyToasts;

type ToastContextType = {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id"> & { id?: string; }) => string;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode; }) {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => wagmiConfig.subscribe(
    state => ({ chainId: state.connections.get(state.current ?? "")?.chainId ?? state.chainId, account: state.connections.get(state.current ?? "")?.accounts[0], status: state.status }),
    (next, previous) => {
      if (next.chainId !== previous.chainId || next.account !== previous.account || next.status === "disconnected") {
        cancelTransactionFlows();
        txToast.dismissPending();
      }
    },
  ), []);

  const addToast = useCallback((toast: Omit<ToastItem, "id"> & { id?: string; }) => {
    const id = toast.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    if (toast.type === "pending") {
      txToast.pending(id, toast.title, toast.description, toast.txHash);
    } else if (toast.type === "success") {
      txToast.success(id, toast.title, toast.description, toast.txHash);
    } else if (toast.type === "error") {
      txToast.error(id, toast.title, toast.description);
    } else {
      txToast.info(id, toast.title, toast.description);
    }
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    txToast.dismiss(id);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
