import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AVATARS, AVATAR_IDS } from "../src/config/avatars";
import { avatarStorageKey, readAvatar, saveAvatar, subscribeAvatar, useAvatar } from "../src/hooks/useAvatar";
import { clearWalletStorage } from "../src/lib/walletSession";
import { txToast } from "../src/lib/txToast";

const address = "0xABC123";
beforeEach(() => {
  const values: Record<string, string> = {};
  const target = new EventTarget();
  const storage = Object.defineProperties(values, {
    getItem: { value: (key: string) => values[key] ?? null },
    setItem: { value: (key: string, value: string) => { values[key] = value; } },
    removeItem: { value: (key: string) => { delete values[key]; } },
  });
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  });
});
afterEach(() => { txToast.dismiss(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("avatar catalog and persistence", () => {
  it("contains the requested 16 unique, self-contained pixel avatars", () => {
    expect(AVATARS).toHaveLength(16);
    expect(AVATAR_IDS.size).toBe(16);
    for (const avatar of AVATARS) {
      expect(avatar.src).toMatch(/^data:image\/svg\+xml;utf8,/);
      const svg = decodeURIComponent(avatar.src.split(",")[1]);
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).not.toMatch(/<script|<image|href=|url\(/i);
    }
  });
  it("isolates wallets, normalizes case, and rejects arbitrary URLs", () => {
    expect(saveAvatar(address, "sqrt-03")).toBe(true);
    expect(readAvatar(address.toLowerCase())).toBe("sqrt-03");
    expect(readAvatar("0xDEF456")).toBe("auto");
    expect(saveAvatar(address, "https://example.com/avatar.png")).toBe(false);
    expect(saveAvatar(address, "sqrt-99")).toBe(false);
    expect(readAvatar(address)).toBe("sqrt-03");
    expect(saveAvatar(address, "auto")).toBe(true);
    expect(readAvatar(address)).toBe("auto");
  });
  it("falls back for stale IDs and renders Auto for SSR despite a saved selection", () => {
    window.localStorage.setItem(avatarStorageKey(address), "removed-id");
    expect(readAvatar(address)).toBe("auto");
    saveAvatar(address, "sqrt-08");
    function Probe() { return createElement("span", null, useAvatar(address).avatar); }
    expect(renderToString(createElement(Probe))).toBe("<span>auto</span>");
    expect(readAvatar(address)).toBe("sqrt-08");
  });
  it("synchronizes subscribers for the same wallet and cleans up subscriptions", () => {
    const navbar = vi.fn(), profile = vi.fn(), otherWallet = vi.fn();
    const unsubscribe = subscribeAvatar(address, navbar);
    const unsubscribeProfile = subscribeAvatar(address.toLowerCase(), profile);
    const unsubscribeOther = subscribeAvatar("0xDEF456", otherWallet);
    saveAvatar(address, "sqrt-02");
    expect(navbar).toHaveBeenCalledTimes(1);
    expect(profile).toHaveBeenCalledTimes(1);
    expect(otherWallet).not.toHaveBeenCalled();
    unsubscribe();
    window.localStorage.setItem(avatarStorageKey(address), "sqrt-04");
    window.dispatchEvent(Object.assign(new Event("storage"), { key: avatarStorageKey(address) }));
    expect(profile).toHaveBeenCalledTimes(2);
    expect(navbar).toHaveBeenCalledTimes(1);
    expect(readAvatar(address)).toBe("sqrt-04");
    unsubscribeProfile(); unsubscribeOther();
  });
  it("preserves saved avatars when wallet connector storage is cleared", () => {
    saveAvatar(address, "sqrt-07");
    window.localStorage.setItem("wagmi.store", "wallet");
    window.localStorage.setItem("rk-test", "wallet");
    clearWalletStorage(window.localStorage);
    expect(readAvatar(address)).toBe("sqrt-07");
    expect(window.localStorage.getItem("wagmi.store")).toBeNull();
  });
  it("keeps the current selection usable when storage is blocked", () => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new Error("Unavailable"); } });
    expect(readAvatar("0xBlocked")).toBe("auto");
    expect(saveAvatar("0xBlocked", "sqrt-06")).toBe(true);
    expect(readAvatar("0xBlocked")).toBe("sqrt-06");
  });
  it("dismisses the fixed avatar update toast after exactly two seconds", () => {
    vi.useFakeTimers();
    txToast.success("avatar-updated", "Avatar updated", undefined, undefined, 2000);
    vi.advanceTimersByTime(1999);
    expect(txToast.getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(txToast.getToasts()).toEqual([]);
  });
});
