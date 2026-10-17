import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const f = vi.hoisted(() => ({ read: vi.fn(), chainId: 43113 }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: true, chainId: f.chainId }),
  useChainId: () => 43113, useReadContract: f.read,
  useReadContracts: () => ({ data: undefined, isLoading: true, isError: true }),
}));
vi.mock("@/lib/contracts/addresses", () => ({ studentRegistryAddress: "0x2222222222222222222222222222222222222222", isStudentRegistryConfigured: true, TARGET_CHAIN_ID: 43113, ZERO_ADDRESS: "0x0000000000000000000000000000000000000000" }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: undefined, admin: undefined, factoryOwner: undefined, isLoading: true, isError: true }) }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: true, isError: true }) }));
import { useRole } from "@/hooks/useRole";
function Status() { const role = useRole(); return createElement("p", null, `${role.role}:${role.isStudent}:${role.isReady}:${role.canParticipate}`); }
beforeEach(() => { vi.clearAllMocks(); f.chainId = 43113; f.read.mockReturnValue({ data: true, isLoading: false, isError: false, refetch: vi.fn() }); });
describe("global Student role independent of rounds", () => {
  it("shows Student even when no round exists and round/project reads fail", () => {
    expect(renderToStaticMarkup(createElement(Status))).toContain("student:true:true:false");
    expect(f.read.mock.calls[0][0]).toMatchObject({ functionName: "isStudent", address: "0x2222222222222222222222222222222222222222" });
  });
  it("does not claim Student on the wrong wallet network", () => {
    f.chainId = 1; expect(renderToStaticMarkup(createElement(Status))).toContain("guest:false:true:false");
  });
  it("does not claim global Student for an unverified wallet", () => {
    f.read.mockReturnValue({ data: false, isLoading: false, isError: false, refetch: vi.fn() });
    expect(renderToStaticMarkup(createElement(Status))).toContain("guest:false:true:false");
  });
});
