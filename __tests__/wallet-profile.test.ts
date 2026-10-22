import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultWalletProfile, readWalletProfile, saveWalletProfile, subscribeWalletProfile, walletProfileKey } from "@/hooks/useWalletProfile";
import { clearWalletStorage } from "@/lib/walletSession";

beforeEach(() => {
  const values = new Map<string, string>();
  const events = new EventTarget();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
});
afterEach(() => vi.unstubAllGlobals());

it("asks new wallets to choose and recognizes existing on-chain profiles", () => {
  expect(defaultWalletProfile(false, false)).toBeNull();
  expect(defaultWalletProfile(false, true)).toBe("student");
  expect(defaultWalletProfile(true, false)).toBe("organizer");
  expect(defaultWalletProfile(true, true)).toBe("organizer");
  expect(readWalletProfile("0xNEW", 43113)).toBeNull();
});
it("persists a single choice per wallet and network, normalizing address case", () => {
  expect(saveWalletProfile("0xABC", 43113, "student")).toBe(true);
  expect(readWalletProfile("0xabc", 43113)).toBe("student");
  expect(readWalletProfile("0xDEF", 43113)).toBeNull();
  expect(readWalletProfile("0xABC", 1)).toBeNull();
  expect(saveWalletProfile("0xabc", 43113, "organizer")).toBe(false);
  expect(saveWalletProfile("0xabc", 43113, "student")).toBe(true);
  expect(readWalletProfile("0xABC", 43113)).toBe("student");
  clearWalletStorage(window.localStorage);
  expect(readWalletProfile("0xABC", 43113)).toBe("student");
});
it("ignores invalid preferences and requires a connected wallet and chain", () => {
  window.localStorage.setItem(walletProfileKey("0xINVALID", 43113), "admin");
  expect(readWalletProfile("0xINVALID", 43113)).toBeNull();
  expect(saveWalletProfile(undefined, 43113, "student")).toBe(false);
  expect(saveWalletProfile("0xABC", undefined, "student")).toBe(false);
});
it("synchronizes matching subscriptions and removes listeners on cleanup", () => {
  const listener = vi.fn(), other = vi.fn();
  const unsubscribe = subscribeWalletProfile("0xSYNC", 43113, listener);
  const unsubscribeOther = subscribeWalletProfile("0xOTHER", 43113, other);
  saveWalletProfile("0xsync", 43113, "student");
  expect(listener).toHaveBeenCalledTimes(1);
  expect(other).not.toHaveBeenCalled();
  window.localStorage.setItem(walletProfileKey("0xSYNC", 43113), "organizer");
  window.dispatchEvent(Object.assign(new Event("storage"), { key: walletProfileKey("0xSYNC", 43113) }));
  expect(listener).toHaveBeenCalledTimes(2);
  expect(readWalletProfile("0xSYNC", 43113)).toBe("organizer");
  unsubscribe(); unsubscribeOther();
  saveWalletProfile("0xsync", 43113, "student");
  expect(listener).toHaveBeenCalledTimes(2);
});
it("keeps choosing usable if local storage is blocked", () => {
  Object.defineProperty(window, "localStorage", { get() { throw new Error("Blocked"); } });
  expect(saveWalletProfile("0xBLOCKED", 43113, "organizer")).toBe(true);
  expect(readWalletProfile("0xBLOCKED", 43113)).toBe("organizer");
});
