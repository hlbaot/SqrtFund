import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Navbar } from "@/components/layout/Navbar";
const f = vi.hoisted(() => ({ read: vi.fn(), chainId: 43113, admin: undefined as string | undefined, factoryOwner: undefined as string | undefined, organizer: false, managed: false, authLoading: false, authError: false, managedLoading: false, legacy: false }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1111111111111111111111111111111111111111", isConnected: true, chainId: f.chainId }),
  useChainId: () => 43113, useReadContract: f.read,
  useReadContracts: () => ({ data: undefined, isLoading: true, isError: true }),
}));
vi.mock("@/lib/contracts/addresses", () => ({ studentRegistryAddress: "0x2222222222222222222222222222222222222222", isStudentRegistryConfigured: true, TARGET_CHAIN_ID: 43113, ZERO_ADDRESS: "0x0000000000000000000000000000000000000000" }));
vi.mock("@/hooks/useRound", () => ({ useRound: () => ({ roundAddress: undefined, admin: f.admin, factoryOwner: f.factoryOwner, isLoading: true, isError: true, isOrganizer: f.organizer, isAuthorizationLoading: f.authLoading, isAuthorizationError: f.authError, isLegacyFactory: f.legacy }) }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: true, isError: true }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/hooks/useNotificationCounts", () => ({ useNotificationCounts: () => ({ admin: 0, student: 0, owner: 0 }) }));
vi.mock("@/components/layout/ConnectWalletButton", () => ({ ConnectWalletButton: () => null }));
vi.mock("@/components/layout/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/common/NetworkGuard", () => ({ NetworkGuard: () => null }));
vi.mock("@/lib/context/locale", async () => { const { copy } = await import("@/lib/copy"); return { useLocale: () => ({ t: copy.vi, locale: "vi" }) }; });
vi.mock("@/hooks/useAdminRounds", () => ({ useAdminRounds: () => ({ rounds: f.managed ? [{address:"0x4444444444444444444444444444444444444444"}] : [], isLoading: f.managedLoading, isError: false, refetch: vi.fn() }) }));
import { useRole } from "@/hooks/useRole";
function Status() { const role = useRole(); return createElement("p", null, `${role.role}:${role.isStudent}:${role.isReady}:${role.canParticipate}`); }
beforeEach(() => { vi.clearAllMocks(); f.chainId = 43113; f.admin = undefined; f.factoryOwner = undefined; f.organizer = false; f.managed = false; f.authLoading = false; f.authError = false; f.managedLoading = false; f.legacy = false; f.read.mockReturnValue({ data: true, isLoading: false, isError: false, refetch: vi.fn() }); });
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

describe("admin authority is independent of student registry reads", () => {
  it.each(["admin", "factoryOwner"] as const)("retains %s menu identity while student verification is loading or errors", authority => {
    f[authority] = "0x1111111111111111111111111111111111111111";
    for (const query of [{data:undefined,isLoading:true,isError:false},{data:undefined,isLoading:false,isError:true}]) {
      f.read.mockReturnValue({...query,refetch:vi.fn()});
      expect(renderToStaticMarkup(createElement(Status))).toContain("admin:false:true:false");
    }
  });
  it("does not grant admin on a different network or to an unrelated wallet", () => {
    f.factoryOwner = "0x1111111111111111111111111111111111111111"; f.chainId = 1;
    expect(renderToStaticMarkup(createElement(Status))).not.toContain("admin:");
    f.chainId = 43113; f.factoryOwner = "0x3333333333333333333333333333333333333333";
    expect(renderToStaticMarkup(createElement(Status))).toContain("student:true:true:false");
  });
});

it("renders the real admin navigation link despite a failed student lookup", () => {
  f.factoryOwner = "0x1111111111111111111111111111111111111111";
  f.read.mockReturnValue({data:undefined,isLoading:false,isError:true,refetch:vi.fn()});
  const html = renderToStaticMarkup(createElement(Navbar));
  expect(html).toContain('href="/admin"'); expect(html).toContain("Quản trị");
});
it("does not expose admin navigation to an unrelated student wallet", () => {
  f.factoryOwner = "0x3333333333333333333333333333333333333333";
  expect(renderToStaticMarkup(createElement(Navbar))).not.toContain('href="/admin"');
});

function Authorization() {
  const result = useRole();
  return createElement("p", null, JSON.stringify({ role: result.role, canCreateRound: result.canCreateRound, hasManagedRounds: result.hasManagedRounds, loading: result.isAuthorizationLoading, error: result.isAuthorizationError, ready: result.isAuthorizationReady }));
}
const authorization = () => JSON.parse(renderToStaticMarkup(createElement(Authorization)).replace(/<[^>]+>/g, "").replaceAll("&quot;", '"'));
it("retains dashboard access after Organizer revocation when an older round still belongs to the wallet", () => {
  f.admin = "0x3333333333333333333333333333333333333333"; f.managed = true;
  expect(authorization()).toMatchObject({ role: "admin", hasManagedRounds: true, canCreateRound: false, ready: true });
});
it("does not conclude guest authorization while Factory reads are pending", () => {
  f.read.mockReturnValue({ data: false, isLoading: false, isError: false }); f.authLoading = true;
  expect(authorization()).toMatchObject({ loading: true, ready: false, error: false });
});
it("waits for round ownership discovery before denying dashboard access", () => {
  f.managedLoading = true;
  expect(authorization()).toMatchObject({ loading: true, ready: false });
});
it("reports failed authorization reads separately from student identity", () => {
  f.authError = true;
  expect(authorization()).toMatchObject({ role: "student", error: true, ready: false });
});
it("recognizes a granted Organizer even when student identity fails", () => {
  f.organizer = true; f.read.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  expect(authorization()).toMatchObject({ role: "admin", canCreateRound: true, ready: true });
});

it("does not enable creating Multi-Organizer rounds on a legacy Factory", () => {
  f.factoryOwner = "0x1111111111111111111111111111111111111111"; f.legacy = true; f.authError = true;
  expect(authorization()).toMatchObject({ role: "admin", canCreateRound: false, ready: true });
});
