// src/lib/txToast.ts
import { getContractErrorMessage, isUserRejected } from "@/lib/errors";
import { copy } from "@/lib/copy";

export type ToastType = "success" | "error" | "info" | "pending";

export type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  txHash?: string;
  feeWei?: bigint;
};

export type ToastListener = (toasts: ToastItem[]) => void;

export const SUCCESS_MS = 3000;
export const ERROR_MS = 2000;

class TxToastStore {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  getToasts(): ToastItem[] {
    return this.toasts;
  }

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const snapshot = [...this.toasts];
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private clearTimer(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  private upsert(item: ToastItem, duration?: number) {
    this.clearTimer(item.id);

    const index = this.toasts.findIndex((t) => t.id === item.id);
    if (index >= 0) {
      // In-place update preserving position
      const updated = [...this.toasts];
      updated[index] = item;
      this.toasts = updated;
    } else {
      this.toasts = [...this.toasts, item];
    }

    if (duration !== undefined && duration !== Infinity) {
      const timer = setTimeout(() => {
        this.dismiss(item.id);
      }, duration);
      this.timers.set(item.id, timer);
    }

    this.notify();
  }

  pending(id: string, title: string, description?: string, txHash?: string) {
    this.upsert({ id, type: "pending", title, description, txHash }, Infinity);
  }

  success(id: string, title: string, description?: string, txHash?: string, duration = SUCCESS_MS, feeWei?: bigint) {
    this.upsert({ id, type: "success", title, description, txHash, feeWei }, duration);
  }

  attachReceipt(id: string, txHash: string, feeWei: bigint) {
    this.toasts = this.toasts.map(item => item.id === id ? { ...item, txHash, feeWei } : item);
    this.notify();
  }

  error(id: string, title: string, description?: string) {
    this.upsert({ id, type: "error", title, description }, ERROR_MS);
  }

  info(id: string, title: string, description?: string) {
    this.upsert({ id, type: "info", title, description }, SUCCESS_MS);
  }

  dismiss(id?: string) {
    if (id) {
      this.clearTimer(id);
      this.toasts = this.toasts.filter((t) => t.id !== id);
    } else {
      for (const [timerId] of this.timers) {
        this.clearTimer(timerId);
      }
      this.toasts = [];
    }
    this.notify();
  }

  dismissPending() {
    const pendingIds = this.toasts.filter((t) => t.type === "pending").map((t) => t.id);
    for (const id of pendingIds) {
      this.clearTimer(id);
    }
    this.toasts = this.toasts.filter((t) => t.type !== "pending");
    this.notify();
  }
}

export const txToast = new TxToastStore();

/**
 * Timeout helper for awaiting block confirmation.
 * Rejects if the promise takes longer than timeoutMs (default 120s).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 120_000,
  errorMessage?: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Flow cancelled", "AbortError"));
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    if (Number.isFinite(timeoutMs)) timer = setTimeout(() => {
      cleanup();
      reject(new TransactionTimeoutError(errorMessage));
    }, timeoutMs);
    promise.then(value => {
      cleanup();
      if (signal?.aborted) abort();
      else resolve(value);
    }, error => { cleanup(); reject(error); });
  });
}

export { isUserRejected } from "@/lib/errors";

/**
 * Standard error handler for transaction toasts.
 * Automatically detects user wallet rejection and block timeouts.
 */
export function handleTxError(
  id: string,
  error: unknown,
  fallbackTitle = "Transaction failed",
  locale: "en" | "vi" = "en"
): void {
  const t = copy[locale].transactions;
  if (isUserRejected(error)) {
    txToast.error(id, t.rejected, t.rejectedDescription);
    return;
  }
  if (error instanceof TransactionTimeoutError || /timeout/i.test(error instanceof Error ? error.message : String(error))) {
    txToast.error(id, t.timeout, t.timeoutDescription);
    return;
  }
  txToast.error(id, fallbackTitle, getContractErrorMessage(error, locale));
}

export class TransactionTimeoutError extends Error {
  constructor(message = "Transaction timeout") { super(message); }
}

const activeFlows = new Set<TransactionFlow>();
export function cancelTransactionFlows() {
  for (const flow of activeFlows) flow.cancel();
}

/** A flow owns its toast IDs and rejects every continuation after cancellation. */
export class TransactionFlow {
  private controller = new AbortController();
  private ids = new Set<string>();
  private failed = false;
  private receipts = new Map<string, bigint>();
  get cancelled() { return this.controller.signal.aborted; }
  constructor() { activeFlows.add(this); }

  private show(method: "pending" | "success" | "error" | "info", args: [string, string, string?, string?]) {
    if (this.cancelled || this.failed) return;
    this.ids.add(args[0]);
    if (method === "success") txToast.success(...args, SUCCESS_MS, args[3] ? this.receipts.get(args[3].toLowerCase()) : undefined);
    else txToast[method](...args);
  }
  readonly toast = {
    pending: (...args: [string, string, string?, string?]) => this.show("pending", args),
    success: (...args: [string, string, string?, string?]) => this.show("success", args),
    error: (...args: [string, string, string?]) => this.show("error", args),
    info: (...args: [string, string, string?]) => this.show("info", args),
    dismiss: (id: string) => { if (!this.cancelled) txToast.dismiss(id); },
  };

  error = (id: string, error: unknown, title?: string, locale: "en" | "vi" = "en") => {
    if (this.cancelled || this.failed) return;
    this.ids.add(id);
    for (const item of txToast.getToasts()) {
      if (item.type === "pending" && item.id !== id && this.ids.has(item.id)) txToast.dismiss(item.id);
    }
    const hash = txToast.getToasts().find(item => item.id === id)?.txHash;
    handleTxError(id, error, title, locale);
    if (hash) {
      const fee = this.receipts.get(hash.toLowerCase());
      if (fee !== undefined) txToast.attachReceipt(id, hash, fee);
    }
    this.failed = true;
    this.finish();
  };

  wait<T>(operation: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const signal = this.controller.signal;
    if (signal.aborted || this.failed) return Promise.reject(new DOMException("Flow cancelled", "AbortError"));
    const promise = Promise.resolve().then(() => {
      if (signal.aborted) throw new DOMException("Flow cancelled", "AbortError");
      return operation();
    }).then(value => {
      const receipt = value as { transactionHash?: unknown; gasUsed?: unknown; effectiveGasPrice?: unknown } | null;
      if (receipt && typeof receipt.transactionHash === "string" && typeof receipt.gasUsed === "bigint" && typeof receipt.effectiveGasPrice === "bigint") {
        this.receipts.set(receipt.transactionHash.toLowerCase(), receipt.gasUsed * receipt.effectiveGasPrice);
      }
      return value;
    });
    return withTimeout(promise, timeoutMs ?? Infinity, undefined, signal);
  }

  finish() { activeFlows.delete(this); }
  cancel() {
    this.controller.abort();
    for (const id of this.ids) txToast.dismiss(id);
    this.finish();
  }
}
