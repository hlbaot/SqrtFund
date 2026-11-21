import { markVisitIntroSeen } from "@/lib/visitIntro";
import { clearOrganizerReadAccess } from "@/lib/store/organizerReadStore";
import type { QueryClient } from "@tanstack/react-query";
import { cancelTransactionFlows, txToast } from "@/lib/txToast";
import type { WalletRole } from "@/hooks/useRole";
import { wagmiConfig } from "@/lib/wagmi";
import { TARGET_CHAIN_ID } from "@/lib/contracts/addresses";

export type WalletSnapshot = { address: string | null; chainId: number; role: WalletRole; };
export const WALLET_SNAPSHOT_KEY = "sqrt-fund:wallet-snapshot";
export const WALLET_LOGOUT_KEY = "sqrt-fund:wallet-logged-out";
let navigating = false;

// Để ngoài namespace wagmi/rk vì logout chủ ý xóa chúng; ví injected vẫn có thể lộ tài khoản sau disconnect và tự authorize.
export function isWalletLoggedOut() {
  if (typeof window === "undefined") return false;
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try { if (window[name].getItem(WALLET_LOGOUT_KEY) === "1") return true; } catch { /* Storage có thể bị tắt. */ }
  }
  return false;
}

export function markWalletConnected() {
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try { window[name].removeItem(WALLET_LOGOUT_KEY); } catch { /* Storage có thể bị tắt. */ }
  }
}

export function markWalletLoggedOut() {
  for (const name of ["sessionStorage", "localStorage"] as const) {
    try { window[name].setItem(WALLET_LOGOUT_KEY, "1"); } catch { /* Storage có thể bị tắt. */ }
  }
}

export function walletChanged(previous: WalletSnapshot, next: WalletSnapshot) {
  return previous.address?.toLowerCase() !== next.address?.toLowerCase() || previous.chainId !== next.chainId || previous.role !== next.role;
}

export interface WalletState {
  address: string | null | undefined;
  status: "connected" | "disconnected" | "connecting" | "reconnecting";
  chainId?: number;
  role?: WalletRole;
}

/** State machine thuần quyết định có reload app hay không: chỉ reload khi disconnect hoặc đổi địa chỉ A→B (cùng khác null); không reload khi undefined/null→address, status connecting/reconnecting, đổi role, hay đổi chainId. */
export function shouldReload(
  prev: WalletState | null,
  next: WalletState
): boolean {
  if (!prev) return false;
  if (next.status === "connecting" || next.status === "reconnecting") return false;

  // Trường hợp 1: Disconnect (trước có địa chỉ, nay đã ngắt)
  if (prev.address && (next.status === "disconnected" || !next.address)) {
    return true;
  }

  // Trường hợp 2: Đổi địa chỉ A → B (cả hai khác null)
  if (
    prev.address &&
    next.address &&
    prev.address.toLowerCase() !== next.address.toLowerCase()
  ) {
    return true;
  }

  return false;
}

export function saveSessionValue(key: string, value: string) {
  try { window.sessionStorage.setItem(key, value); } catch { /* Storage có thể bị tắt. */ }
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
    if (key.endsWith(".disconnected")) continue;
    if (key.startsWith("wagmi") || key.startsWith("rk-")) storage.removeItem(key);
  }
}
export function reloadWallet(snapshot: WalletSnapshot) {
  if (navigating) return;
  navigating = true;
  cancelTransactionFlows();
  txToast.dismiss();
  saveSessionValue(WALLET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  if (snapshot.address) markWalletConnected();
  markVisitIntroSeen();
  window.location.reload();
}
/** Xóa danh tính ví tại chỗ để canvas trang trí và vị trí cuộn được giữ. */
export async function logoutWallet(disconnect: () => Promise<unknown>, queryClient: QueryClient) {
  if (navigating) return;
  navigating = true;
  clearOrganizerReadAccess();
  markWalletLoggedOut();
  cancelTransactionFlows();
  txToast.dismiss();
  try {
    await disconnect();
  } catch {
    // Xóa danh tính cục bộ kể cả khi wallet provider không thu hồi được quyền.
  } finally {
    try {
      wagmiConfig.setState(state => ({ ...state, connections: new Map(), current: null, status: "disconnected" }));
      await queryClient.cancelQueries();
      queryClient.clear();
      try { clearWalletStorage(window.localStorage); } catch { /* Storage có thể bị tắt. */ }
      try { clearWalletStorage(window.sessionStorage); } catch { /* Storage có thể bị tắt. */ }
      saveSessionValue(WALLET_SNAPSHOT_KEY, JSON.stringify({ address: null, chainId: TARGET_CHAIN_ID, role: "guest" }));
      markVisitIntroSeen();
    } finally {
      // Logout không còn rời trang nên các thao tác connect/logout sau đó phải hoạt động.
      navigating = false;
    }
  }
}
