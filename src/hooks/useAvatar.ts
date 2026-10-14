"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AVATAR_IDS } from "@/config/avatars";

export const AVATAR_CHANGE_EVENT = "avatar-changed";
const memoryFallback = new Map<string, string>();
export const avatarStorageKey = (address: string) => `sqrt-fund:avatar:${address.toLowerCase()}`;
export const validAvatarId = (id: unknown): id is string => typeof id === "string" && (id === "auto" || AVATAR_IDS.has(id));

export function readAvatar(address?: string): string {
  if (!address || typeof window === "undefined") return "auto";
  const key = avatarStorageKey(address);
  if (memoryFallback.has(key)) return memoryFallback.get(key)!;
  try {
    const value = window.localStorage.getItem(key);
    return validAvatarId(value) ? value : "auto";
  } catch { return "auto"; }
}

export function saveAvatar(address: string | undefined, id: string): boolean {
  if (!address || !validAvatarId(id) || typeof window === "undefined") return false;
  const key = avatarStorageKey(address);
  try {
    window.localStorage.setItem(key, id);
    memoryFallback.delete(key);
  } catch {
    // The current session still updates if browser storage is unavailable.
    memoryFallback.set(key, id);
  }
  window.dispatchEvent(new CustomEvent(AVATAR_CHANGE_EVENT, { detail: { address: address.toLowerCase() } }));
  return true;
}

export function subscribeAvatar(address: string | undefined, listener: () => void) {
  if (!address || typeof window === "undefined") return () => {};
  const key = avatarStorageKey(address);
  const changed = (event: Event) => {
    const detail = (event as CustomEvent<{ address?: string }>).detail;
    if (detail?.address === address.toLowerCase()) listener();
  };
  const stored = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      memoryFallback.delete(key);
      listener();
    }
  };
  window.addEventListener(AVATAR_CHANGE_EVENT, changed);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(AVATAR_CHANGE_EVENT, changed);
    window.removeEventListener("storage", stored);
  };
}

const serverSnapshot = () => "auto";
export function useAvatar(address?: string) {
  const subscribe = useCallback((listener: () => void) => subscribeAvatar(address, listener), [address]);
  const snapshot = useCallback(() => readAvatar(address), [address]);
  const avatar = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setAvatar = useCallback((id: string) => saveAvatar(address, id), [address]);
  return { avatar, setAvatar, isAuto: avatar === "auto" };
}
