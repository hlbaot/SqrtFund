"use client";
import { useSyncExternalStore } from "react";
const subscribe = (notify: () => void) => {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
};
const visible = () => document.visibilityState === "visible";
export function useVisiblePolling() {
  return useSyncExternalStore(subscribe, visible, () => false) ? 5000 : false;
}
