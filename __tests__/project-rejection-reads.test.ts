import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ContractFunctionZeroDataError, decodeFunctionResult, encodeFunctionResult, type Abi } from "viem";
import type { GovernanceRecord } from "@/lib/roundGovernance";
import { useProjects } from "@/hooks/useProjects";
import { qfRoundAbi } from "@/lib/contracts/abis";
import { legacyProjectAbi } from "@/lib/contracts/legacyProjectAbi";
const state = vi.hoisted(() => ({ records: [] as GovernanceRecord[], categoryError: false, modern: true, rpcError: false, viewer: "0x1111111111111111111111111111111111111111", enabled: false, lastAbi: undefined as unknown, retryProbe: vi.fn(), retryProjects: vi.fn() }));
const owner = "0x1111111111111111111111111111111111111111";
const roundAddress = "0x2222222222222222222222222222222222222222";
const raw = { id: 1n, owner, name: "Rejected proposal", description: "D", imageUrl: "", link: "", approved: false, claimed: false, sumSqrt: 0n, totalDonated: 0n, donorCount: 0n } as const;
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: "0x2222222222222222222222222222222222222222", admin: "0x3333333333333333333333333333333333333333" }) }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: state.viewer, isConnected: true, chainId: 43113 }),
  useReadContract: () => ({ data: state.modern ? false : undefined, isSuccess: state.modern, isError: !state.modern, error: state.modern ? undefined : state.rpcError ? new Error("RPC down") : new ContractFunctionZeroDataError({ functionName: "rejected" }), refetch: state.retryProbe }),
  useReadContracts: (options: { contracts: { abi: Abi }[]; query: { enabled: boolean } }) => {
    if (!options.contracts.length) return { data: [], refetch: vi.fn() };
    state.enabled = options.query.enabled; state.lastAbi = options.contracts[0].abi;
    const sourceAbi = state.modern ? qfRoundAbi : legacyProjectAbi;
    const result = state.modern ? [[{ ...raw, rejected: true }], 1n] as const : [[raw], 1n] as const;
    const encoded = encodeFunctionResult({ abi: sourceAbi, functionName: "getProjects", result });
    const decoded = decodeFunctionResult({ abi: options.contracts[0].abi, functionName: "getProjects", data: encoded });
    return { data: [{ status: "success", result: decoded }, { status: "success", result: [[], []] }], isLoading: false, isError: false, refetch: state.retryProjects };
  },
}));
function probe() { let snapshot: ReturnType<typeof useProjects> | undefined; function Probe() { snapshot = useProjects(roundAddress); return null; } renderToStaticMarkup(createElement(Probe)); return snapshot!; }
beforeEach(() => { state.records = []; state.categoryError = false; state.modern = true; state.rpcError = false; state.viewer = owner; vi.clearAllMocks(); });
it("decodes the appended rejection flag and keeps rejected records for their owner", () => {
  const data = probe(); expect(data.supportsRejection).toBe(true); expect(data.projects[0]).toMatchObject({ id: "1", rejected: true, status: "rejected", name: raw.name }); expect(state.enabled).toBe(true);
});
it("hides a rejected record from a public visitor", () => { state.viewer = "0x4444444444444444444444444444444444444444"; expect(probe().projects).toEqual([]); });
it("uses the frozen old tuple ABI for a round without the getter", () => {
  state.modern = false; const data = probe(); expect(data.supportsRejection).toBe(false); expect(data.projects[0]).toMatchObject({ rejected: false, status: "pending", name: raw.name }); expect(state.lastAbi).toBe(legacyProjectAbi); expect(state.enabled).toBe(true);
});
it("does not treat an RPC outage as evidence for the old tuple layout", () => {
  state.modern = false; state.rpcError = true; const data = probe(); expect(state.enabled).toBe(false); expect(data.isError).toBe(true);
  data.refetch(); expect(state.retryProbe).toHaveBeenCalledOnce(); expect(state.retryProjects).not.toHaveBeenCalled();
});

vi.mock("@/hooks/useRoundGovernance", () => ({ useRoundGovernance: () => ({ data: state.records, isError: state.categoryError }) }));

it("hydrates the signed category from durable records instead of a chain default", () => {
  expect(probe().projects[0].category).toBe("uncategorized");
  state.records = [{ id: 1, kind: "category", owner_address: owner, transaction_hash: null, created_at: "2026-10-30T00:00:00Z", payload: { kind: "category", round: roundAddress, rulesVersion: "2026-10-30", projectId: "1", category: "community" } }];
  expect(probe().projects[0].category).toBe("community");
  state.records = []; state.categoryError = true;
  expect(probe().projects[0].category).toBe("uncategorized");
  expect(probe().categoriesUnavailable).toBe(true);
});
