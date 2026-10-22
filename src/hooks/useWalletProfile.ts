"use client";

import { useCallback, useSyncExternalStore } from "react";

export type WalletProfile = "student" | "organizer";
const changeEvent = "sqrt-fund:wallet-profile-changed";
const memoryFallback = new Map<string, WalletProfile>();
export const walletProfileKey = (address: string, chainId: number) => `sqrt-fund:profile:${chainId}:${address.toLowerCase()}`;
export const isWalletProfile = (value: unknown): value is WalletProfile => value === "student" || value === "organizer";

/** This is a display preference; it never grants Student or Organizer permissions. */
export function readWalletProfile(address?: string, chainId?: number): WalletProfile | null {
  if (!address || !chainId || typeof window === "undefined") return null;
  const key = walletProfileKey(address, chainId);
  if (memoryFallback.has(key)) return memoryFallback.get(key)!;
  try {
    const value = window.localStorage.getItem(key);
    return isWalletProfile(value) ? value : null;
  } catch { return null; }
}

export function saveWalletProfile(address: string | undefined, chainId: number | undefined, profile: WalletProfile): boolean {
  if (!address || !chainId || !isWalletProfile(profile) || typeof window === "undefined") return false;
  const existing = readWalletProfile(address, chainId);
  if (existing) return existing === profile;
  const key = walletProfileKey(address, chainId);
  try { window.localStorage.setItem(key, profile); memoryFallback.delete(key); }
  catch { memoryFallback.set(key, profile); }
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: { key } }));
  return true;
}

export function switchWalletProfile(address: string | undefined, chainId: number | undefined, profile: WalletProfile): boolean {
  if (!address || !chainId || !isWalletProfile(profile) || typeof window === "undefined") return false;
  const key = walletProfileKey(address, chainId);
  try { window.localStorage.setItem(key, profile); memoryFallback.delete(key); }
  catch { memoryFallback.set(key, profile); }
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: { key } }));
  return true;
}

export function clearWalletProfile(address: string | undefined, chainId: number | undefined): boolean {
  if (!address || !chainId || typeof window === "undefined") return false;
  const key = walletProfileKey(address, chainId);
  try { window.localStorage.removeItem(key); memoryFallback.delete(key); }
  catch { memoryFallback.delete(key); }
  window.dispatchEvent(new CustomEvent(changeEvent, { detail: { key } }));
  return true;
}

export function subscribeWalletProfile(address: string | undefined, chainId: number | undefined, listener: () => void) {
  if (!address || !chainId || typeof window === "undefined") return () => {};
  const key = walletProfileKey(address, chainId);
  const changed = (event: Event) => { if ((event as CustomEvent<{ key: string }>).detail?.key === key) listener(); };
  const stored = (event: StorageEvent) => {
    if (event.key === key || event.key === null) { memoryFallback.delete(key); listener(); }
  };
  window.addEventListener(changeEvent, changed);
  window.addEventListener("storage", stored);
  return () => { window.removeEventListener(changeEvent, changed); window.removeEventListener("storage", stored); };
}

export function defaultWalletProfile(organizer: boolean, student: boolean): WalletProfile | null {
  return organizer ? "organizer" : student ? "student" : null;
}

const serverSnapshot = () => null;
export function useWalletProfile(address?: string, chainId?: number, defaultProfile: WalletProfile | null = null) {
  const subscribe = useCallback((listener: () => void) => subscribeWalletProfile(address, chainId, listener), [address, chainId]);
  const snapshot = useCallback(() => readWalletProfile(address, chainId), [address, chainId]);
  const saved = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const selectProfile = useCallback((profile: WalletProfile) => saveWalletProfile(address, chainId, profile), [address, chainId]);
  const switchProfile = useCallback((profile: WalletProfile) => switchWalletProfile(address, chainId, profile), [address, chainId]);
  const resetProfile = useCallback(() => clearWalletProfile(address, chainId), [address, chainId]);
  return { profile: saved ?? defaultProfile, selectProfile, switchProfile, resetProfile };
}
