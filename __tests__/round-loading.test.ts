import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContractFunctionRevertedError, ContractFunctionZeroDataError, HttpRequestError, type Address } from "viem";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { loadRoundFields, isVersionReadError, roundCoreFunctions, logContractReadFailure, type RoundCapability, type RoundReadCall } from "@/lib/contracts/roundReads";
import { RoundsList } from "@/components/rounds/RoundsList";
import type { RoundSummary } from "@/components/leaderboard/model";
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ locale: "vi", t: copy.vi }) }; });
const good = "0x1111111111111111111111111111111111111111" as Address;
const bad = "0x2222222222222222222222222222222222222222" as Address;
const registry = "0x3333333333333333333333333333333333333333" as Address;
const revert = () => new ContractFunctionRevertedError({ abi: qfRoundAbi, functionName: "studentRegistry", data: "0x" });
const success = (calls: readonly RoundReadCall[]) => calls.map(call => ({ status: "success" as const, result: call.functionName === "studentRegistry" ? registry : call.functionName === "name" ? "Healthy round" : call.functionName === "organizer" ? "Club" : 1n }));
afterEach(() => vi.restoreAllMocks());
it("probes legacy once and never sends modern detail getters to it", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const cache = new Map<string, RoundCapability>();
  const read = vi.fn(async (calls: readonly RoundReadCall[]) => calls[0].functionName === "studentRegistry" ? [{ status: "failure" as const, error: revert() }] : success(calls));
  const first = await loadRoundFields(read, bad, cache);
  const second = await loadRoundFields(read, bad, cache);
  expect(first.version).toBe("legacy"); expect(second.version).toBe("legacy");
  expect(read.mock.calls.map(([calls]) => calls.map(c => c.functionName))).toEqual([["studentRegistry"], [...roundCoreFunctions], [...roundCoreFunctions]]);
  expect(first.results.slice(12).map(r => r.status)).toEqual(["skipped", "skipped", "skipped"]);
});
it("loads modern fields only after the registry capability succeeds", async () => {
  const read = vi.fn(async (calls: readonly RoundReadCall[]) => success(calls));
  const result = await loadRoundFields(read, good);
  expect(result.version).toBe("current"); expect(result.registry).toBe(registry);
  expect(read.mock.calls[1][0].map(c => c.functionName)).toContain("maxPerRound");
});
it("a field revert in one round preserves successful fields and other rounds", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const read = async (calls: readonly RoundReadCall[]) => success(calls).map((value, index) => calls[index].address === bad && calls[index].functionName === "pool" ? { status: "failure" as const, error: revert() } : value);
  const [a, b] = await Promise.all([loadRoundFields(read, good), loadRoundFields(read, bad)]);
  expect(a.results.every(r => r.status === "success")).toBe(true);
  expect(b.results[7].status).toBe("failure"); expect(b.results[0].status).toBe("success");
  expect(isVersionReadError(b.results[7].error)).toBe(true);
});
it("an RPC failure is retryable, is not cached as legacy and does not stop another round", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const cache = new Map<string, RoundCapability>();
  const network = new HttpRequestError({ url: "https://rpc.invalid", status: 503 });
  const read = async (calls: readonly RoundReadCall[]) => {
    if (calls[0].address === bad) throw network;
    return success(calls);
  };
  const [a, b] = await Promise.allSettled([loadRoundFields(read, good, cache), loadRoundFields(read, bad, cache)]);
  expect(a.status).toBe("fulfilled"); expect(b.status).toBe("rejected");
  expect(cache.has(bad.toLowerCase())).toBe(false); expect(isVersionReadError(network)).toBe(false);
});
it("recognizes zero data and wrapped reverts as version incompatibility", () => {
  expect(isVersionReadError(new ContractFunctionZeroDataError({ functionName: "studentRegistry" }))).toBe(true);
  expect(isVersionReadError(new Error("wrapper", { cause: revert() }))).toBe(true);
});
it("logs only address/function/kind, never provider URL credentials", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  logContractReadFailure(registry, "pool", new HttpRequestError({ url: "https://rpc.invalid/credential-sentinel", status: 503 }));
  const output = JSON.stringify(warn.mock.calls);
  expect(output).toContain("pool"); expect(output).toContain(registry); expect(output).not.toContain("credential-sentinel");
});
it("renders an individual error and legacy label while keeping a healthy round card", () => {
  const base: RoundSummary = { id: good, number: 1, title: "Healthy round", name: "Healthy round", description: "", sponsorName: "", status: "finalized", phase: "finalized", matchingPool: 0, totalDonated: 0, totalSupporters: 0, projectCount: 0, startTime: "2026-10-01T00:00:00Z", endTime: "2026-10-02T00:00:00Z" };
  const html = renderToStaticMarkup(createElement(RoundsList, { rounds: [base, { ...base, id: bad, number: 2, readError: "version" }] }));
  expect(html).toContain("Healthy round"); expect(html).toContain(`href="/round/${good}"`);
  expect(html).toContain("Không đọc được round này"); expect(html).toContain("Contract không khớp phiên bản");
  expect(html).toContain("Round phiên bản cũ"); expect(html).toContain(bad);
  expect(html).not.toContain("Không tải được dữ liệu");
});
