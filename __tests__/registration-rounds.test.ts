import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { useRegistrationRounds } from "@/hooks/useRegistrationRounds";
import { studentRegistryAddress } from "@/lib/contracts/addresses";
import type { RoundFields } from "@/lib/contracts/roundReads";

const f = vi.hoisted(() => ({ addresses: [] as Address[], fields: {} as Record<string, RoundFields>, failed: [] as string[], factoryError: false }));
vi.mock("@/lib/contracts/addresses", () => ({
  factoryAddress: `0x${"4".repeat(40)}`, studentRegistryAddress: `0x${"5".repeat(40)}`, TARGET_CHAIN_ID: 43113,
}));
vi.mock("@/hooks/useRound", () => ({ useFactoryRounds: () => ({
  factoryData: [{ status: f.factoryError ? "failure" : "success", result: f.addresses }],
  isFactoryLoading: false, isFactoryError: f.factoryError, refetchFactory: vi.fn(),
}) }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => 1000 }));
vi.mock("wagmi", () => ({ usePublicClient: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ useQueries: ({ queries }: { queries: { queryKey: string[] }[] }) => queries.map(query => ({
  data: f.fields[query.queryKey[2]], isError: f.failed.includes(query.queryKey[2]), refetch: vi.fn(),
})) }));
const first = `0x${"1".repeat(40)}` as Address;
const second = `0x${"2".repeat(40)}` as Address;
const third = `0x${"3".repeat(40)}` as Address;
function fields(endTime = 2000n): RoundFields {
  const results = Array.from({ length: 17 }, () => ({ status: "success" as const, result: 0n as unknown }));
  results[3].result = endTime; results[8].result = false; results[15].result = false; results[12].result = "Student fund";
  return { version: "current", registry: studentRegistryAddress, results };
}
function read(initial?: string) {
  let value: ReturnType<typeof useRegistrationRounds>;
  function Probe() { value = useRegistrationRounds(initial); return null; }
  renderToStaticMarkup(createElement(Probe));
  return value!;
}
beforeEach(() => { f.addresses = []; f.fields = {}; f.failed = []; f.factoryError = false; });
it("reports an empty new Factory without inventing a registry mismatch or loading forever", () => {
  expect(read()).toMatchObject({ rounds: [], roundAddress: undefined, isLoading: false, isError: false });
});
it("lists only eligible rounds, newest first, and honors a requested older round", () => {
  f.addresses = [first, second, third];
  f.fields = { [first]: fields(), [second]: fields(), [third]: fields(900n) };
  expect(read().rounds.map(round => round.address)).toEqual([second, first]);
  expect(read().roundAddress).toBe(second);
  expect(read(first).roundAddress).toBe(first);
});
it("does not replace a requested closed round with another open round", () => {
  f.addresses = [first, second]; f.fields = { [first]: fields(), [second]: fields(900n) };
  expect(read(second)).toMatchObject({ roundAddress: undefined, selectionUnavailable: true });
});
it("reports a Factory RPC error separately from an empty successful result", () => {
  f.factoryError = true;
  expect(read()).toMatchObject({ isLoading: false, isError: true });
});
it("reports selected-round RPC errors without claiming that the round is closed", () => {
  f.addresses = [first, second]; f.fields = { [first]: fields() }; f.failed = [second];
  expect(read(second)).toMatchObject({ isError: true, selectedReadError: true, selectionUnavailable: false, roundAddress: undefined });
});
it("waits for all round metadata before choosing a default", () => {
  f.addresses = [first, second]; f.fields = { [first]: fields() };
  expect(read().isLoading).toBe(true);
});
