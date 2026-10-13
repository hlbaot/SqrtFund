"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
}

function getSnapshot() {
  return Math.floor(Date.now() / 1000);
}

function getServerSnapshot() {
  return 0;
}

export function useCurrentTimestamp() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
