"use client";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createFormDraftStore, type DraftFields, type DraftSnapshot } from "@/lib/formDrafts";

const store = createFormDraftStore(() => window.localStorage);

export function useFormDraft<T extends DraftFields>(key: string | undefined, defaults: T, initial?: () => T) {
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const empty = useMemo<DraftSnapshot>(() => ({ values: defaults, ready: false, hasDraft: false, storageError: false }), [defaults]);
  const subscribe = useCallback((listener: () => void) => key ? store.subscribe(key, listener) : () => {}, [key]);
  const snapshot = useCallback(() => key ? store.snapshot(key) ?? empty : empty, [key, empty]);
  const serverSnapshot = useCallback(() => empty, [empty]);
  const draft = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  useEffect(() => {
    if (!key) return;
    const createInitial = () => initialRef.current?.() ?? defaults;
    store.hydrate(key, defaults, createInitial);
    const changed = (event: StorageEvent) => {
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
      if (event.key === key) store.stored(key, event.newValue, createInitial);
      else if (event.key === null) store.stored(key, null, createInitial);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key, defaults]);
  const setField = useCallback((field: keyof T & string, value: string) => { if (key) store.setField(key, field, value); }, [key]);
  // Callback giữ key của lần render đã gửi giao dịch; kết quả trễ không xóa nháp ví/Round mới.
  const clear = useCallback(() => { if (key) store.clear(key, initialRef.current?.() ?? defaults); }, [key, defaults]);
  const clearSubmitted = useCallback(() => {
    if (key) store.clear(key, initialRef.current?.() ?? defaults, draft.values);
  }, [key, defaults, draft.values]);
  return { ...draft, values: draft.values as T, setField, clear, clearSubmitted };
}
