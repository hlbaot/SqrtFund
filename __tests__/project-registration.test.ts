import { expect, it } from "vitest";
import type { Address } from "viem";
import { registrationRoundState, selectRegistrationRound } from "@/lib/projectRegistration";
import type { RoundFields } from "@/lib/contracts/roundReads";

const registry = `0x${"1".repeat(40)}` as Address;
const first = `0x${"2".repeat(40)}` as Address;
const second = `0x${"3".repeat(40)}` as Address;
function fields(): RoundFields {
  const results = Array.from({ length: 17 }, () => ({ status: "success" as const, result: 0n as unknown }));
  results[2].result = 1500n; // Upcoming donations do not prevent project registration.
  results[3].result = 2000n;
  results[8].result = false;
  results[15].result = false;
  return { version: "current", registry, results };
}
it("permits registration before donations start, with the shared registry", () => {
  expect(registrationRoundState(fields(), 1000, registry)).toBe("open");
});
it("closes registration exactly at the end timestamp", () => {
  expect(registrationRoundState(fields(), 2000, registry)).toBe("closed");
});
it.each([8, 15])("excludes finalized or cancelled rounds (field %s)", index => {
  const round = fields();
  round.results = round.results.map((result, i) => i === index ? { ...result, result: true } : result);
  expect(registrationRoundState(round, 1000, registry)).toBe("closed");
});
it("excludes a different or missing registry without treating the student as unverified", () => {
  expect(registrationRoundState({ ...fields(), registry: second }, 1000, registry)).toBe("incompatible");
  expect(registrationRoundState({ ...fields(), registry: undefined }, 1000, registry)).toBe("incompatible");
});
it("keeps RPC errors distinct from closed rounds", () => {
  const round = fields();
  round.results = round.results.map((result, i) => i === 3 ? { status: "failure", error: new Error("RPC unavailable") } : result);
  expect(registrationRoundState(round, 1000, registry)).toBe("error");
});
it("waits for the clock and contract fields before deciding availability", () => {
  expect(registrationRoundState(undefined, 1000, registry)).toBe("loading");
  expect(registrationRoundState(fields(), 0, registry)).toBe("loading");
});
it("defaults to the first open round in the newest-first list", () => {
  expect(selectRegistrationRound([{ address: first, state: "closed" }, { address: second, state: "open" }])?.address).toBe(second);
});
it("honors an explicit round rather than defaulting to another open round", () => {
  const rounds = [{ address: first, state: "open" as const }, { address: second, state: "open" as const }];
  expect(selectRegistrationRound(rounds, second.toUpperCase())?.address).toBe(second);
});
it("never silently substitutes an invalid, closed, incompatible or missing requested round", () => {
  expect(selectRegistrationRound([{ address: first, state: "open" }], "invalid")).toBeUndefined();
  for (const state of ["closed", "incompatible", "error", "loading"] as const) {
    expect(selectRegistrationRound([{ address: first, state: "open" }, { address: second, state }], second)).toBeUndefined();
  }
  expect(selectRegistrationRound([])).toBeUndefined();
});
