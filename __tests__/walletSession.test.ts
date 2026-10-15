import { describe, expect, it } from "vitest";
import {
  clearWalletStorage,
  walletChanged,
  shouldReload,
  type WalletSnapshot,
  type WalletState,
} from "../src/lib/walletSession";

describe("wallet reload identity", () => {
  const baseline: WalletSnapshot = { address: "0xAbC", chainId: 43113, role: "student" };
  it("ignores address casing and unchanged snapshots", () => {
    expect(walletChanged(baseline, { ...baseline, address: "0xabc" })).toBe(false);
  });
  it("detects account, network, role changes and external logout", () => {
    for (const next of [
      { ...baseline, address: "0xdef" }, { ...baseline, address: null },
      { ...baseline, chainId: 1 }, { ...baseline, role: "admin" as const },
    ]) expect(walletChanged(baseline, next)).toBe(true);
  });
  it("clears only connector persistence keys", () => {
    const storage = { "wagmi.store": "wallet", "wagmi.recentConnectorId": "core", "rk-wallet": "wallet", locale: "vi", "sqrt-fund:wallet-snapshot": "snapshot" };
    const adapter = Object.assign(storage, { removeItem(key: string) { delete (storage as Record<string, unknown>)[key]; } });
    clearWalletStorage(adapter as unknown as Storage);
    expect(storage).toMatchObject({ locale: "vi", "sqrt-fund:wallet-snapshot": "snapshot" });
    expect(Object.keys(storage).filter(key => /^(wagmi|rk-)/.test(key))).toEqual([]);
  });
});

describe("WalletWatcher shouldReload state machine", () => {
  const addrA = "0x1111111111111111111111111111111111111111";
  const addrB = "0x2222222222222222222222222222222222222222";

  it("undefined -> A (first connect or auto-reconnect): false", () => {
    const prev: WalletState = { address: null, status: "disconnected" };
    const next: WalletState = { address: addrA, status: "connected" };
    expect(shouldReload(prev, next)).toBe(false);

    // Initial mount with prev null
    expect(shouldReload(null, next)).toBe(false);
  });

  it("A -> B (switched accounts in wallet): true", () => {
    const prev: WalletState = { address: addrA, status: "connected" };
    const next: WalletState = { address: addrB, status: "connected" };
    expect(shouldReload(prev, next)).toBe(true);
  });

  it("A -> undefined (disconnected): true", () => {
    const prev: WalletState = { address: addrA, status: "connected" };
    const nextDisconnected: WalletState = { address: null, status: "disconnected" };
    expect(shouldReload(prev, nextDisconnected)).toBe(true);

    const nextNoAddr: WalletState = { address: undefined, status: "disconnected" };
    expect(shouldReload(prev, nextNoAddr)).toBe(true);
  });

  it("A(loading role) -> A(admin) (role changed for same address): false", () => {
    const prev: WalletState = { address: addrA, status: "connected", role: "guest" };
    const next: WalletState = { address: addrA, status: "connected", role: "admin" };
    expect(shouldReload(prev, next)).toBe(false);
  });

  it("reconnecting -> connected for same wallet: false", () => {
    const prev: WalletState = { address: addrA, status: "reconnecting" };
    const next: WalletState = { address: addrA, status: "connected" };
    expect(shouldReload(prev, next)).toBe(false);
  });

  it("does not reload during transient connecting/reconnecting states", () => {
    const prev: WalletState = { address: addrA, status: "connected" };
    const nextConnecting: WalletState = { address: addrB, status: "connecting" };
    expect(shouldReload(prev, nextConnecting)).toBe(false);

    const nextReconnecting: WalletState = { address: addrB, status: "reconnecting" };
    expect(shouldReload(prev, nextReconnecting)).toBe(false);
  });
});

