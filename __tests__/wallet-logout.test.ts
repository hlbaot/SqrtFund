import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createConfig, createStorage, http, injected } from "wagmi";
import { connect, disconnect, reconnect } from "wagmi/actions";
import type { EIP1193Provider } from "viem";
import { avalancheFuji } from "viem/chains";

vi.mock("../src/lib/wagmi", () => ({ wagmiConfig: { setState: vi.fn() } }));

function memoryStorage(): Storage {
  const storage: Record<string, unknown> = {};
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => storage[key] ?? null },
    setItem: { value: (key: string, value: string) => { storage[key] = value; } },
    removeItem: { value: (key: string) => { delete storage[key]; } },
  });
  return storage as unknown as Storage;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", {
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    location: { replace: vi.fn(), reload: vi.fn() },
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("wallet logout persistence", () => {
  it("stays logged out after reload even when an injected wallet still exposes authorized accounts", async () => {
    const session = await import("../src/lib/walletSession");
    const address = "0x0000000000000000000000000000000000000001";
    const provider = {
      request: vi.fn(async ({ method }: { method: string }) => {
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
        if (method === "eth_chainId") return "0xa869";
        // Core-style wallets can keep their permission after dApp disconnect.
        throw Object.assign(new Error("Unsupported method"), { code: 4200 });
      }),
      on: vi.fn(), removeListener: vi.fn(),
    };
    const config = createConfig({
      chains: [avalancheFuji], transports: { [avalancheFuji.id]: http() },
      multiInjectedProviderDiscovery: false,
      storage: createStorage({ storage: window.localStorage }),
      connectors: [injected({ target: { id: "test-core", name: "Test Core", provider: provider as unknown as EIP1193Provider } })],
    });
    await connect(config, { connector: config.connectors[0] });
    const client = new QueryClient();
    client.setQueryData(["wallet-balance"], "100");
    const seenKey = `sqrt-fund:notifications-seen:${address}`;
    window.localStorage.setItem(seenKey, '["refund:0xround"]');
    await session.logoutWallet(() => disconnect(config), client);
    expect(config.state.status).toBe("disconnected");
    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(seenKey)).toBe('["refund:0xround"]');
    expect(Object.keys(window.localStorage).filter(key => key.startsWith("wagmi"))).toEqual(["wagmi.test-core.disconnected"]);
    // The retained shim blocks authorization even though the provider still exposes accounts.
    expect(await config.connectors[0].isAuthorized()).toBe(false);
    vi.resetModules(); // A fresh page must still remember explicit logout.
    const reloaded = await import("../src/lib/walletSession");
    const reconnectOnMount = !reloaded.isWalletLoggedOut();
    if (reconnectOnMount) await reconnect(config);
    expect(reconnectOnMount).toBe(false);
    expect(config.state.status).toBe("disconnected");
    // Explicit Connect Wallet is allowed and removes the logout guard after success.
    reloaded.markWalletConnected();
    await connect(config, { connector: config.connectors[0] });
    expect(config.state.status).toBe("connected");
    expect(reloaded.isWalletLoggedOut()).toBe(false);
    await disconnect(config);
  });

  it("cleans up and retains logout intent if the connector throws", async () => {
    const session = await import("../src/lib/walletSession");
    const client = new QueryClient();
    client.setQueryData(["private-wallet-data"], "stale");
    await expect(session.logoutWallet(async () => { throw new Error("Provider disconnected"); }, client)).resolves.toBeUndefined();
    expect(session.isWalletLoggedOut()).toBe(true);
    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it("retains logout intent after a rejected reconnect and tolerates unavailable storage", async () => {
    const session = await import("../src/lib/walletSession");
    window.sessionStorage.setItem(session.WALLET_LOGOUT_KEY, "1");
    window.localStorage.setItem(session.WALLET_LOGOUT_KEY, "1");
    // A failed connection never calls markWalletConnected.
    expect(session.isWalletLoggedOut()).toBe(true);
    Object.defineProperty(window, "localStorage", { get: () => { throw new Error("Storage disabled"); }, configurable: true });
    expect(session.isWalletLoggedOut()).toBe(true);
    session.markWalletConnected();
    expect(session.isWalletLoggedOut()).toBe(false);
  });
});

it("allows another connect/logout cycle without remounting the page", async () => {
  const session = await import("../src/lib/walletSession");
  const client = new QueryClient();
  const disconnect = vi.fn().mockResolvedValue(undefined);
  await session.logoutWallet(disconnect, client);
  session.markWalletConnected();
  expect(session.isWalletLoggedOut()).toBe(false);
  await session.logoutWallet(disconnect, client);
  expect(disconnect).toHaveBeenCalledTimes(2);
  expect(session.isWalletLoggedOut()).toBe(true);
  expect(window.location.reload).not.toHaveBeenCalled();
  expect(window.location.replace).not.toHaveBeenCalled();
});
