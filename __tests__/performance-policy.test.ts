import { afterEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { defaultQueryPolicy, QUERY_GC_MS, QUERY_STALE_MS, CLIENT_MULTICALL_BATCH } from "@/lib/queryPolicy";
import { isRouteNavigation } from "@/lib/navigationProgress";

afterEach(() => vi.useRealTimers());
it("reuses an exact cached query during quick route revisits, then refreshes stale data", async () => {
  vi.useFakeTimers();
  const client = new QueryClient({ defaultOptions: { queries: defaultQueryPolicy } });
  const read = vi.fn().mockResolvedValue("data");
  const options = { queryKey: ["round-fields", 43113, "round-a"], queryFn: read };
  await client.fetchQuery(options);
  await vi.advanceTimersByTimeAsync(10_000);
  await client.fetchQuery(options);
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(QUERY_STALE_MS);
  await client.fetchQuery(options);
  expect(read).toHaveBeenCalledTimes(2);
  client.clear();
});
it("does not reuse another wallet's balance or another round's fields", async () => {
  const client = new QueryClient({ defaultOptions: { queries: defaultQueryPolicy } });
  await client.fetchQuery({ queryKey: ["token-balance", 43113, "token", "wallet-a"], queryFn: async () => 1100n });
  expect(client.getQueryData(["token-balance", 43113, "token", "wallet-b"])).toBeUndefined();
  await client.fetchQuery({ queryKey: ["round-fields", 43113, "round-a"], queryFn: async () => ({ pool: 1000n }) });
  expect(client.getQueryData(["round-fields", 43113, "round-b"])).toBeUndefined();
  client.clear();
});
it("retains cache longer than freshness and bounds batch waiting and retries", () => {
  expect(QUERY_GC_MS).toBeGreaterThan(QUERY_STALE_MS); expect(CLIENT_MULTICALL_BATCH.wait).toBeLessThanOrEqual(25);
  expect(defaultQueryPolicy.retry).toBe(2); expect(defaultQueryPolicy.retryDelay(8)).toBeLessThanOrEqual(3000);
});
it("starts route feedback only for an actual same-origin page or query change", () => {
  const current = new URL("https://www.sqrtfund.tech/rounds");
  expect(isRouteNavigation(new URL("/verify", current), current)).toBe(true);
  expect(isRouteNavigation(new URL("/rounds?sort=new", current), current)).toBe(true);
  expect(isRouteNavigation(new URL("#projects", current), current)).toBe(false);
  expect(isRouteNavigation(new URL("https://example.org/verify"), current)).toBe(false);
});
