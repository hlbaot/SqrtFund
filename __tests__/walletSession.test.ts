import { describe, expect, it } from "vitest";
import { clearWalletStorage, walletChanged, type WalletSnapshot } from "../src/lib/walletSession";

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
