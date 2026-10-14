import type { QueryClient } from "@tanstack/react-query";
import { cancelTransactionFlows, txToast } from "@/lib/txToast";
import type { WalletRole } from "@/hooks/useRole";
import { wagmiConfig } from "@/lib/wagmi";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";

export type WalletSnapshot = { address: string | null; chainId: number; role: WalletRole; };
export const WALLET_SNAPSHOT_KEY = "sqrt-fund:wallet-snapshot";
export const WALLET_LOGOUT_KEY = "sqrt-fund:wallet-logged-out";
let navigating = false;

// Keep this outside the wagmi/rk namespaces: logout deliberately clears those.
// Injected wallets can still expose accounts after disconnect and auto-authorize.
export function isWalletLoggedOut() {
  if (typeof window === "undefined") return false;
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try { if (window[name].getItem(WALLET_LOGOUT_KEY) === "1") return true; } catch { /* Storage may be disabled. */ }
  }
  return false;
}

export function markWalletConnected() {
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try { window[name].removeItem(WALLET_LOGOUT_KEY); } catch { /* Storage may be disabled. */ }
  }
}

function markWalletLoggedOut() {
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try { window[name].setItem(WALLET_LOGOUT_KEY, "1"); } catch { /* Storage may be disabled. */ }
  }
}

export function walletChanged(previous: WalletSnapshot, next: WalletSnapshot) {
  return previous.address?.toLowerCase() !== next.address?.toLowerCase() || previous.chainId !== next.chainId || previous.role !== next.role;
}
export function saveSessionValue(key: string, value: string) {
  try { window.sessionStorage.setItem(key, value); } catch { /* Storage may be disabled. */ }
}
export function takeSessionValue(key: string) {
  try {
    const value = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    return value;
  } catch { return null; }
}
export function clearWalletStorage(storage: Storage) {
  for (const key of Object.keys(storage)) {
    if (key.startsWith("wagmi") || key.startsWith("rk-")) storage.removeItem(key);
  }
}
export function reloadWallet(snapshot: WalletSnapshot) {
  if (navigating) return;
  navigating = true;
  cancelTransactionFlows();
  txToast.dismiss();
  saveSessionValue(WALLET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  window.location.reload();
}
export async function logoutWallet(disconnect: () => Promise<unknown>, queryClient: QueryClient) {
  if (navigating) return;
  navigating = true;
  markWalletLoggedOut();
  cancelTransactionFlows();
  txToast.dismiss();
  try { await disconnect(); } finally {
    // Clear every local connection, including when the provider fails to revoke permissions.
    wagmiConfig.setState(state => ({ ...state, connections: new Map(), current: null, status: "disconnected" }));
    queryClient.clear();
    try { clearWalletStorage(window.localStorage); } catch { /* Storage may be disabled. */ }
    try { clearWalletStorage(window.sessionStorage); } catch { /* Storage may be disabled. */ }
    saveSessionValue(WALLET_SNAPSHOT_KEY, JSON.stringify({ address: null, chainId: TARGET_CHAIN_ID, role: "guest" }));
    window.location.replace("/");
  }
}
