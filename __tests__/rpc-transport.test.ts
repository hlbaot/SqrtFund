import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createPublicClient, decodeFunctionData, encodeAbiParameters, encodeFunctionResult, erc20Abi, multicall3Abi } from "viem";
import { avalancheFuji } from "viem/chains";
import { createFujiTransport } from "@/lib/contracts/rpc";
import { CLIENT_MULTICALL_BATCH } from "@/lib/queryPolicy";
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

it("combines concurrent contract reads into one Multicall3 eth_call", async () => {
  const result = encodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", result: [
    { success: true, returnData: encodeAbiParameters([{ type: "uint256" }], [5n]) },
    { success: true, returnData: encodeAbiParameters([{ type: "uint256" }], [9n]) },
  ] });
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const input = JSON.parse(init!.body as string);
    const answer = (item: { id: number }) => ({ jsonrpc: "2.0", id: item.id, result });
    return new Response(JSON.stringify(Array.isArray(input) ? input.map(answer) : answer(input)), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  const client = createPublicClient({ chain: avalancheFuji, batch: { multicall: CLIENT_MULTICALL_BATCH }, transport: createFujiTransport("https://primary.invalid") });
  const pending = Promise.all(["0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"].map(address => client.readContract({ address: address as `0x${string}`, abi: erc20Abi, functionName: "totalSupply" })));
  await vi.advanceTimersByTimeAsync(100);
  expect(await pending).toEqual([5n, 9n]); expect(fetch).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(fetch.mock.calls[0][1]!.body as string);
  const calls = Array.isArray(payload) ? payload : [payload];
  expect(calls).toHaveLength(1); expect(calls[0].method).toBe("eth_call");
  expect(calls[0].params[0].to.toLowerCase()).toBe(avalancheFuji.contracts.multicall3.address.toLowerCase());
});

it("reduces a 50-item two-address read list from four multicalls to one with the larger budget", async () => {
  const readGroups: number[] = [];
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const input = JSON.parse(init!.body as string);
    const batch = Array.isArray(input) ? input : [input];
    readGroups.push(batch.length);
    const responses = batch.map(item => {
      const decoded = decodeFunctionData({ abi: multicall3Abi, data: item.params[0].data });
      const calls = decoded.args![0] as readonly unknown[];
      const result = encodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", result: calls.map(() => ({ success: true, returnData: encodeAbiParameters([{ type: "uint256" }], [1n]) })) });
      return { jsonrpc: "2.0", id: item.id, result };
    });
    return new Response(JSON.stringify(Array.isArray(input) ? responses : responses[0]), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  const token = "0x1111111111111111111111111111111111111111" as const;
  const spender = "0x2222222222222222222222222222222222222222" as const;
  const contracts = Array.from({ length: 50 }, () => ({ address: token, abi: erc20Abi, functionName: "allowance" as const, args: [token, spender] as const }));
  for (const batchSize of [1024, CLIENT_MULTICALL_BATCH.batchSize]) {
    const client = createPublicClient({ chain: avalancheFuji, batch: { multicall: { wait: 20, batchSize } }, transport: createFujiTransport("https://primary.invalid") });
    const pending = client.multicall({ contracts, allowFailure: false });
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual(Array(50).fill(1n));
  }
  expect(readGroups).toEqual([4, 1]);
});
