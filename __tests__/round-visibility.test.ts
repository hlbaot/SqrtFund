import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { isPublicRound } from "@/lib/roundVisibility";

const state = vi.hoisted(() => ({ rounds: ["0x483048c8fcaD691dEFa96da09Db918cC6632347B"] as Address[] }));
vi.mock("wagmi", () => ({
  useReadContracts: () => ({ data: [{ status: "success", result: state.rounds }, { status: "success", result: "0x1111111111111111111111111111111111111111" }], isLoading: false, isError: false }),
  usePublicClient: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ isLoading: false, isError: false }) }));
vi.mock("@/hooks/useCurrentTimestamp", () => ({ useCurrentTimestamp: () => 0 }));
import { useRound } from "@/hooks/useRound";
const archived = "0x483048c8fcaD691dEFa96da09Db918cC6632347B" as Address;
const active = "0x2222222222222222222222222222222222222222" as Address;
beforeEach(() => { state.rounds = [archived]; });

function probe(address?: Address) {
  let result: ReturnType<typeof useRound>;
  function Probe() { result = useRound(address); return null; }
  renderToStaticMarkup(createElement(Probe));
  return result!;
}

it("hides only the selected Fuji round regardless of address casing", () => {
  expect(isPublicRound(archived, 43113)).toBe(false);
  expect(isPublicRound(archived.toLowerCase(), 43113)).toBe(false);
  expect(isPublicRound(archived, 43114)).toBe(true);
  expect(isPublicRound(active, 43113)).toBe(true);
});
it("does not choose the archived round as the public default", () => {
  expect(probe().roundAddress).toBeUndefined();
});
it("keeps all Factory addresses available for administrative access", () => {
  expect(probe().allRounds).toEqual([archived]);
});
it("keeps direct access to the archived contract for fund management", () => {
  expect(probe(archived).roundAddress).toBe(archived);
});
it("chooses the newest visible round even when an archived address is last", () => {
  state.rounds = [active, archived];
  expect(probe().roundAddress).toBe(active);
});
