import { afterEach, describe, expect, it, vi } from "vitest";

const address = "0x1111111111111111111111111111111111111111";
const hash = `0x${"ab".repeat(32)}`;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Fuji explorer URLs", () => {
  it("links addresses, transaction history and transaction hashes to Snowtrace by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_EXPLORER_URL", undefined);
    vi.resetModules();
    const { explorerAddressUrl, explorerTxUrl } = await import("@/lib/explorer");
    expect(explorerAddressUrl(address)).toBe(`https://testnet.snowtrace.io/address/${address}`);
    expect(explorerAddressUrl(address, true)).toBe(`https://testnet.snowtrace.io/address/${address}#transactions`);
    expect(explorerTxUrl(hash)).toBe(`https://testnet.snowtrace.io/tx/${hash}`);
  });

  it("uses the configured explorer consistently and removes trailing slashes", async () => {
    vi.stubEnv("NEXT_PUBLIC_EXPLORER_URL", "https://explorer.example///");
    vi.resetModules();
    const { explorerAddressUrl, explorerTxUrl } = await import("@/lib/explorer");
    const { getExplorerAddressUrl, getExplorerTxUrl } = await import("@/lib/format");
    expect(explorerAddressUrl(address)).toBe(`https://explorer.example/address/${address}`);
    expect(explorerTxUrl(hash)).toBe(`https://explorer.example/tx/${hash}`);
    expect(getExplorerAddressUrl(address)).toBe(explorerAddressUrl(address));
    expect(getExplorerTxUrl(hash)).toBe(explorerTxUrl(hash));
  });

  it("keeps input within a single path segment", async () => {
    vi.stubEnv("NEXT_PUBLIC_EXPLORER_URL", undefined);
    vi.resetModules();
    const { explorerAddressUrl, explorerTxUrl } = await import("@/lib/explorer");
    expect(explorerAddressUrl("value/?#")).toBe("https://testnet.snowtrace.io/address/value%2F%3F%23");
    expect(explorerTxUrl("value/?#")).toBe("https://testnet.snowtrace.io/tx/value%2F%3F%23");
  });
});
