import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { useAdminRounds } from "@/hooks/useAdminRounds";
const state = vi.hoisted(() => ({ factoryFailure: false, adminFailure: false, rounds: ["0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333", "0x4444444444444444444444444444444444444444"] }));
const admin = "0x1111111111111111111111111111111111111111";
vi.mock("@/lib/contracts/addresses", () => ({ TARGET_CHAIN_ID: 43113, factoryAddress: "0xbC077E28826D0738E56491800bdb8D5725F9e5b3" }));
vi.mock("@/hooks/useRound", () => ({ useFactoryRounds: () => ({ factoryData: [{ status: state.factoryFailure ? "failure" : "success", result: state.factoryFailure ? undefined : state.rounds }], isFactoryLoading: false, isFactoryError: false }) }));
vi.mock("wagmi", () => ({ useReadContracts: () => ({ data: state.rounds.flatMap((_, i) => [{ status: state.adminFailure ? "failure" : "success", result: i === 2 ? "0x5555555555555555555555555555555555555555" : "0x1111111111111111111111111111111111111111" }, { status: "success", result: `Round ${i + 1}` }]), isPending: false, isError: false }) }));
beforeEach(() => { state.factoryFailure = false; state.adminFailure = false; state.rounds = ["0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333", "0x4444444444444444444444444444444444444444"]; });
function probe() { let result: ReturnType<typeof useAdminRounds> | undefined; function Probe() { result = useAdminRounds(admin as Address); return null; } renderToStaticMarkup(createElement(Probe)); return result!; }
it("defaults to the latest round belonging to the admin, excludes the newer foreign-admin round", () => {
  const result = probe(); expect(result.roundAddress).toBe(state.rounds[1]); expect(result.rounds.map(round => round.address)).toEqual([state.rounds[1], state.rounds[0]]); expect(result.isLoading).toBe(false);
});
it("returns a genuine empty selection for an empty factory", () => { state.rounds = []; const result = probe(); expect(result).toMatchObject({ rounds: [], totalRounds: 0, roundAddress: undefined, isError: false, isLoading: false }); });
it("reports a failed getRounds call instead of treating it as an empty factory", () => { state.factoryFailure = true; expect(probe().isError).toBe(true); });
it("does not silently hide failed admin lookups as no admin rounds", () => { state.adminFailure = true; expect(probe().isError).toBe(true); });
