import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPublicClient } from "viem";
import { avalancheFuji } from "viem/chains";
import { createFujiTransport } from "@/lib/contracts/rpc";
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function reply(init?: RequestInit) {
  const body = JSON.parse(init!.body as string);
  const result = (item: { id: number; method: string }) => ({ jsonrpc: "2.0", id: item.id, result: item.method === "eth_chainId" ? "0xa869" : "0x1" });
  return new Response(JSON.stringify(Array.isArray(body) ? body.map(result) : result(body)), { status: 200, headers: { "Content-Type": "application/json" } });
}
it("batches concurrent browser RPC calls into one HTTP request", async () => {
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => reply(init)); vi.stubGlobal("fetch", fetch);
  const client = createPublicClient({ chain: avalancheFuji, transport: createFujiTransport("https://primary.invalid") });
  const pending = Promise.all([client.getChainId(), client.getBlockNumber()]);
  await vi.advanceTimersByTimeAsync(50);
  expect(await pending).toEqual([43113, 1n]); expect(fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toHaveLength(2);
});
it("backs off failed primary requests and reaches the optional fallback", async () => {
  const fetch = vi.fn(async (url: unknown, init?: RequestInit) => String(url).includes("primary") ? new Response("unavailable", { status: 503 }) : reply(init)); vi.stubGlobal("fetch", fetch);
  const client = createPublicClient({ chain: avalancheFuji, transport: createFujiTransport("https://primary.invalid", "https://secondary.invalid") });
  const pending = client.getChainId();
  await vi.advanceTimersByTimeAsync(10000);
  expect(await pending).toBe(43113);
  expect(fetch.mock.calls.filter(([url]) => String(url).includes("primary"))).toHaveLength(3);
  expect(fetch.mock.calls.some(([url]) => String(url).includes("secondary"))).toBe(true);
});
