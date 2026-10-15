import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ data: [
  { status: "success", result: 1000n },
  { status: "success", result: 3600n },
  { status: "success", result: 100_000_000n },
  { status: "success", result: 100_000_000n },
  { status: "success", result: 1_000_000_000n },
] as { status: string; result: bigint }[] | undefined }));
vi.mock("../src/lib/contracts/addresses", () => ({ TARGET_CHAIN_ID: 43113, usdcAddress: "0x1111111111111111111111111111111111111111" }));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x0000000000000000000000000000000000000001", isConnected: true, chainId: 43113 }),
  useChainId: () => 43113,
  useReadContracts: () => ({ data: fixture.data, isLoading: !fixture.data, refetch: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  usePublicClient: () => ({ getBlock: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("../src/hooks/useRound", () => ({ useRound: () => ({ roundAddress: undefined }) }));
vi.mock("../src/hooks/useTxFlow", () => ({ useTxFlow: () => vi.fn() }));
vi.mock("../src/lib/context/locale", () => ({ useLocale: () => ({ t: { faucet: { claimedSuccess: "Done" }, transactions: {} }, locale: "en" }) }));
import { useClaim } from "../src/hooks/useClaim";

afterEach(() => vi.restoreAllMocks());

describe("faucet prerender", () => {
  it("does not read wall-clock time or expose claiming before hydration, and keeps the 1h cooldown", () => {
    const date = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Date.now during prerender"); });
    let snapshot: ReturnType<typeof useClaim> | undefined;
    function Probe() { snapshot = useClaim(); return createElement("span", null, snapshot.remainingSeconds); }
    expect(renderToString(createElement(Probe))).toBe("<span>0</span>");
    expect(date).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({ nextClaimAt: 4600, remainingSeconds: 0, cooldownDuration: 3600, canClaim: false });
  });
  it("keeps claiming disabled while contract reads are unresolved", () => {
    fixture.data = undefined;
    let snapshot: ReturnType<typeof useClaim> | undefined;
    function Probe() { snapshot = useClaim(); return createElement("span", null, String(snapshot.canClaim)); }
    expect(renderToString(createElement(Probe))).toBe("<span>false</span>");
    expect(snapshot?.isLoading).toBe(true);
  });
});
